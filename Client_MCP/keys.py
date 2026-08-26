"""The keys this agent runs on, asked for from the FocusLab backend.

The user types their keys into FocusLab's settings page, which saves them in
the backend's database. This process cannot open that file - under compose the
database volume belongs to the backend container alone, and this one mounts
neither it nor a .env of the user's - so it asks over HTTP, the same hop
FocusLab_MCP/notes.py already makes to read notes.

ANTHROPIC_KEY in Client_MCP/.env still works and is what a standalone run of
this folder has before anyone opens the app. It is the fallback now, though:
a key saved in FocusLab wins over one in a file, because someone who pastes a
key into the app expects it to be the one in use.

No caching on purpose. A key saved a moment ago should work on the next
message, not after a restart, and the callers each build their client once and
keep it, so this runs a handful of times per process rather than per request.
"""

import os

import httpx

def _api_url() -> str:
    """Where the backend is. Read per call, not at import: this module is
    imported before client_MCP.py loads its .env, so an import-time read would
    miss a FOCUSLAB_API_URL set there."""
    return os.getenv("FOCUSLAB_API_URL", "http://localhost:8000").rstrip("/")


def _resolved() -> dict:
    """What the backend says the saved keys are, or {} if it cannot say."""
    try:
        reply = httpx.get(f"{_api_url()}/keys/resolved", timeout=5)
        reply.raise_for_status()
        return reply.json()
    # A backend that is down, still starting, or older than this route is not
    # an error: it just means falling through to the environment below.
    except (httpx.HTTPError, ValueError):
        return {}


def require_anthropic_key() -> str:
    """The Claude API key to run on, refusing to go on without one.

    Every caller needs a key to do anything at all, so there is no variant that
    hands back None for them to check. The message is written for whoever is
    looking at the chat panel when it fails, so it names the thing they have to
    go and do.
    """
    # ANTHROPIC_KEY is the name Client_MCP/.env uses, ANTHROPIC_API_KEY the SDK's
    key = (
        _resolved().get("anthropic_key")
        or os.getenv("ANTHROPIC_KEY")
        or os.getenv("ANTHROPIC_API_KEY")
    )
    if not key:
        raise RuntimeError(
            "No Claude API key. Add one on the FocusLab settings page "
            "(the gear in the sidebar)."
        )
    return key
