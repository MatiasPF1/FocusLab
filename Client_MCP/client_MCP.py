"""
FocusAI Agent that connects with the FocusLab MCP server.
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

NOTES
The user's own notes are a separate world from Canvas, and reaching them is
always two steps:

  1. list_notes  - every note, with its id, title and a preview.
  2. read_notes  - the bodies of the ids step 1 handed you.

NEVER CALL read_notes WITHOUT HAVING CALLED list_notes. There is no other
source of note ids: they are not in the title, the user does not know them, and
one you made up will either fail or quietly return somebody else's note. This
holds even when the user names a note exactly - the name still has to be looked
up to get its id.

Titles are optional, so notes come back as "(untitled)" often enough that the
preview matters more than the title when working out which one is meant. Match
on substrings, case-insensitively. When two or three notes could be it, read
them all in one read_notes call and answer from whichever actually fits; asking
the user to disambiguate is a last resort, not a first move.

Answer only from what a note actually says. A note reads [image] where a
screenshot was pasted - that picture is not available to you, so say it is
there rather than guessing what it showed.

FILES AND DOWNLOADS
The person asking is reading your reply in a chat panel in their browser, and
that panel renders Markdown. So hand files over as links they can click:

    - [L1.Automata.pdf](<the file's url>) (1183 KB)

Use the `url` each file tool already returns. It is pre-signed and expires, so
give it out when you find it rather than describing the file and waiting.

download_files is the other thing entirely: it writes to ~/Downloads on the
machine running this agent, which is not necessarily theirs. Reach for it only
when someone asks for files saved to disk, and say where they landed. When they
just want the file, a link is the answer.

ANSWERING
Never state a number, filename, date or grade the tools did not return. If a
tool comes back empty, report that rather than filling the gap. Be brief.
"""


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
                ChatAnthropic(model="claude-haiku-4-5", max_tokens=4096),
                tools,
                prompt=PROMPT,
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
