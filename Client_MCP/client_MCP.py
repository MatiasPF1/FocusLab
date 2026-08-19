"""
LangGraph agent over FocusLab's own Canvas MCP server.
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

####
# 1- MCP Client
####

# the model emits arrows and dashes; a cp1252 console raises on print without this
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
MCP = {
    "canvas": {
        "command": sys.executable,
        "args": [str(HERE.parent / "FocusLab_MCP" / "server.py")],
        "transport": "stdio",
        "cwd": str(HERE.parent / "FocusLab_MCP"),
    }
}

#####
# 2- Agent Role
#####


PROMPT = f"""
You answer questions about my Canvas coursework. Be brief.

Today is {date.today():%Y-%m-%d}.

NAMING A COURSE
Every course carries two names, and they are not what the field names suggest:
  name  = the section code, e.g. "2026S CS 334-A"
  title = the readable one,  e.g. "Theory of Computation"
People almost always say the title, or a fragment of either ("334", "CS334",
"theory of comp", "linear algebra"). So:

  1. Call list_courses or get_grades first and match against BOTH fields,
     case-insensitively, on substrings - never on an exact string.
  2. Never invent or guess a course id. Every id must come from a tool result.
  3. If several courses match, ask which one, listing title, code and term.
  4. If none match, say so and show the courses you did find for that term.
     Do not conclude the course does not exist - it may be in another term.

TERMS
Terms are named like "2026 Spring Semester". Pass one to get_grades or
list_courses when the question names a semester. "This semester" means the most
recent term that actually has grades: a term that has just started has none yet,
so falling back to the newest graded term is correct, and say which you used.
A course from years ago is still available - search all terms before giving up.

ANSWERING
Never state a number, filename, date or grade the tools did not return. If a
tool comes back empty, report that rather than filling the gap. Be brief.
"""


####
# 3-Client Activation
####

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
