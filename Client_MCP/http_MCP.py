"""
HTTP front door for the FocusAI agent.

    browser  --HTTP-->  this file  -->  client_MCP  --stdio-->  FocusLab_MCP

It runs beside the main backend rather than inside it, because the agent's
dependencies (langgraph, langchain-anthropic) and its Anthropic key already
live in this folder and the backend has no other use for either.

It also serves /latex, the Notebook's page conversion. That one is not the
agent at all - see latex.py - and is here only because it needs the same key.

Run it from this folder:
    uvicorn http_MCP:app --port 8001 --reload
"""

import base64
import os
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from client_MCP import ask
from latex import repair, to_latex
from pdf import CompileError, to_pdf

app = FastAPI(title="FocusAI Agent", version="0.1.0")

# The browser calls this service directly, so it needs the same CORS treatment
# the backend gives the frontend. Same env var name, read from this .env.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
    max_age=600,
)


class Message(BaseModel):
    # "assistant" rather than the panel's "agent" - this is what the model
    # expects, so the frontend translates on its way out.
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


class ChatReply(BaseModel):
    reply: str


@app.post("/chat", response_model=ChatReply)
async def chat(request: ChatRequest) -> ChatReply:
    """Answer the transcript. The whole history comes with every request."""
    if not request.messages:
        raise HTTPException(status_code=422, detail="No messages to answer.")

    try:
        reply = await ask([message.model_dump() for message in request.messages])
    except Exception as error:
        # The panel shows this line to the user, so keep it short and readable.
        raise HTTPException(status_code=502, detail=f"The agent failed: {error}")

    return ChatReply(reply=reply)


##########
# Notebook -> LaTeX
##########

'''
The Notebook's output pane, and nothing to do with the agent above: no tools,
no history, one page in and one document out. It is served from here because
this is the process that holds the Anthropic key.
'''


class LatexRequest(BaseModel):
    # The page as it stands in the editor, not as it was last saved - the
    # Notebook posts what is on screen so a conversion never misses the last
    # few keystrokes.
    html: str
    title: str = ""
    page: int = 1
    page_count: int = 1


class LatexReply(BaseModel):
    latex: str
    # base64, because this is JSON. None when the document would not compile,
    # and then pdf_error says why.
    pdf: str | None = None
    pdf_error: str | None = None


async def _render(source: str, images) -> tuple[str, bytes | None, str | None]:
    """Compile the document, and give a document that will not compile one fix.

    Returns the source that was actually used - a repair rewrites it, and the
    pane has to show what produced the PDF rather than the draft that failed.
    When even the repair will not compile it is the original that comes back,
    with the log that original produced: a repair that did not work is not
    something to hand somebody in place of their transcription.

    A page that will not typeset at all is not an error. The transcription is
    the valuable half and it is handed back either way.
    """
    try:
        return source, await to_pdf(source, images), None
    except CompileError as failure:
        # Held onto here: Python drops the name at the end of the block.
        log = failure.log

    try:
        fixed = await repair(source, log)
        return fixed, await to_pdf(fixed, images), None
    except CompileError:
        return source, None, log
    except Exception as error:
        return source, None, str(error)


@app.post("/latex", response_model=LatexReply)
async def latex(request: LatexRequest) -> LatexReply:
    """Transcribe one notebook page, and typeset what comes back."""
    try:
        conversion = await to_latex(
            request.html,
            title=request.title,
            page=request.page,
            page_count=request.page_count,
        )
    except ValueError as error:
        # An empty page or one too long to send: the user can act on these, so
        # the message is theirs to read rather than a generic failure.
        raise HTTPException(status_code=422, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"The conversion failed: {error}")

    source, pdf, pdf_error = await _render(conversion.source, conversion.images)

    return LatexReply(
        latex=source,
        pdf=base64.b64encode(pdf).decode() if pdf else None,
        pdf_error=pdf_error,
    )
