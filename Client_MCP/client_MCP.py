"""
FocusAI Agent that connects with the FocusLab MCP server.
"""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

from keys import require_anthropic_key
from prompt import build_prompt

HERE = Path(__file__).parent
# Loaded first so keys.py can fall back to it, but the key the agent actually
# runs on is resolved in get_agent() below - the settings page owns it now.
load_dotenv(HERE / ".env")

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
        # Without this the MCP stdio transport hands the server a filtered
        # default environment - PATH and little else - and every setting we
        # pass in from outside is silently missing. The Canvas tools survive
        # that only because their core module loads the .env off disk itself;
        # anything configured through the environment, like FOCUSLAB_API_URL
        # under Docker, arrives empty and falls back to a wrong default.
        "env": dict(os.environ),
    }
}

#####
# 2- Agent Role
#####

'''
The system prompt is assembled from Client_MCP/skills/, one folder per
capability, and built per request rather than once at import: this process
stays up for days at a time, and the prompt carries today's date.

See prompt.py for the format and for why the skills are loaded here rather
than through the Agent Skills API.
'''


def _system_prompt(state):
    """What create_react_agent hands the model: the prompt, then the history."""
    return [{"role": "system", "content": build_prompt()}] + state["messages"]


####
# 3-Client Activation
####

# Built on first use and then kept. get_tools() spawns server.py over stdio, so
# rebuilding per question would pay a fresh Python start-up on every message the
# chat panel sends. The lock stops two requests arriving together from both
# doing that work.
_agent = None
_agent_lock = asyncio.Lock()


async def get_agent():
    global _agent
    async with _agent_lock:
        if _agent is None:
            tools = await MultiServerMCPClient(MCP).get_tools()
            _agent = create_react_agent(
                # Passed in rather than left to the SDK's own environment
                # lookup, since the key normally comes from the settings page
                # and was never in this process's environment to be found.
                ChatAnthropic(
                    model="claude-haiku-4-5",
                    max_tokens=4096,
                    api_key=require_anthropic_key(),
                ),
                tools,
                prompt=_system_prompt,
            )
    return _agent


def _text(content):
    """Flatten a reply to a plain string.

    langchain-anthropic hands back a list of content blocks whenever the model
    emitted more than bare text, and the HTTP callers want one string.
    """
    if isinstance(content, str):
        return content
    return "".join(
        block.get("text", "") for block in content if isinstance(block, dict)
    )


async def ask(messages):
    """Answer a transcript of {"role", "content"} dicts with the agent's reply.

    Stateless on purpose: the caller owns the history and resends all of it, so
    two browser tabs asking at once never see each other's conversation.
    """
    agent = await get_agent()
    reply = await agent.ainvoke({"messages": messages})
    return _text(reply["messages"][-1].content)


async def main(question):
    print(await ask([{"role": "user", "content": question}]))


if __name__ == "__main__":
    q = " ".join(sys.argv[1:]) or "What are my grades this semester, and what have I not submitted?"
    asyncio.run(main(q))
