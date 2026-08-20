"""
HTTP front door for the FocusAI agent.

    browser  --HTTP-->  this file  -->  client_MCP  --stdio-->  FocusLab_MCP

It runs beside the main backend rather than inside it, because the agent's
dependencies (langgraph, langchain-anthropic) and its Anthropic key already
live in this folder and the backend has no other use for either.

Run it from this folder:
    uvicorn http_MCP:app --port 8001 --reload
"""

import os
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from client_MCP import ask

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
