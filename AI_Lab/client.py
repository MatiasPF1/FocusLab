"""
LangGraph agent over FocusLab's own Canvas MCP server.

    python client.py                       # default question
    python client.py "how did I do in CS 115?"

stdio transport: a plain script gets Windows' ProactorEventLoop, which can spawn
subprocesses. Jupyter cannot, which is why this is a .py and not a notebook.
"""

import asyncio
import os
import sys
from datetime import date
from pathlib import Path
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

HERE = Path(__file__).parent
load_dotenv(HERE / ".env")
os.environ["ANTHROPIC_API_KEY"] = os.environ["ANTHROPIC_KEY"]   # .env uses the shorter name

MCP = {
    "canvas": {
        "command": sys.executable,
        "args": [str(HERE / "server.py")],
        "transport": "stdio",
        "cwd": str(HERE),
    }
}

PROMPT = f"""You answer questions about my Canvas coursework. Be brief.

Today is {date.today():%Y-%m-%d}. Terms are named like "2026 Spring Semester".
Pass a term to get_grades when the question names one. "This semester" means the
most recent term that actually has grades - a term that has just started has none.

Course ids come from list_courses or get_grades; the per-assignment tools need an
id, never a name. Never state a number the tools did not return."""


async def main(question):
    tools = await MultiServerMCPClient(MCP).get_tools()
    agent = create_react_agent(
        ChatAnthropic(model="claude-haiku-4-5", max_tokens=4096),
        tools,
        prompt=PROMPT,
    )
    reply = await agent.ainvoke({"messages": [{"role": "user", "content": question}]})
    print(reply["messages"][-1].content)


if __name__ == "__main__":
    q = " ".join(sys.argv[1:]) or "What are my grades this semester, and what have I not submitted?"
    asyncio.run(main(q))
