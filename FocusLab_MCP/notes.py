"""Reading the user's To-Do notes for the MCP server.

Notes live in the backend's database, not in a file this process can open, so
this goes through the same /notes API the To-Do page uses. Under Docker the
agent reaches the backend by service name; standalone it is localhost.

The editor stores note bodies as HTML - it is a contentEditable surface driven
by document.execCommand - and a pasted screenshot lands in there as an <img>
carrying a base64 data URI. Handing that to a model would spend a fortune of
context on markup and image bytes it cannot read anyway, so everything here
returns flattened plain text.
"""

import os
from html.parser import HTMLParser

import httpx

API_URL = os.getenv("FOCUSLAB_API_URL", "http://localhost:8000").rstrip("/")

# Tags whose text is markup rather than content, and whose bodies are dropped.
_SKIPPED = {"script", "style"}

# Tags that end a line. Without these the whole note flattens into one run-on
# paragraph and the model loses the shape of a bulleted list.
_BREAKS = {
    "p", "div", "br", "li", "tr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "pre",
}


class _Flattener(HTMLParser):
    """HTML in, readable text out.

    convert_charrefs is on by default, so &amp; and friends arrive already
    decoded through handle_data and need no separate handling.
    """

    def __init__(self):
        super().__init__()
        self._parts: list[str] = []
        self._skipping = 0

    def handle_starttag(self, tag, attrs):
        if tag in _SKIPPED:
            self._skipping += 1
        elif tag == "img":
            # The src is usually a base64 data URI. Say a picture was here and
            # throw the bytes away.
            self._parts.append("\n[image]\n")
        elif tag in _BREAKS:
            self._parts.append("\n")

    def handle_endtag(self, tag):
        if tag in _SKIPPED and self._skipping:
            self._skipping -= 1
        elif tag in _BREAKS:
            self._parts.append("\n")

    def handle_data(self, data):
        if not self._skipping:
            self._parts.append(data)

    def text(self) -> str:
        # Collapse the runs of blank lines the tag pairs above leave behind,
        # and strip trailing spaces so lines compare cleanly.
        lines = [line.strip() for line in "".join(self._parts).splitlines()]
        out: list[str] = []
        for line in lines:
            if line or (out and out[-1]):
                out.append(line)
        return "\n".join(out).strip()


def _plain(html: str) -> str:
    parser = _Flattener()
    parser.feed(html or "")
    parser.close()
    return parser.text()


def _fetch(path: str):
    response = httpx.get(f"{API_URL}{path}", timeout=15)
    response.raise_for_status()
    return response.json()


def list_notes() -> list[dict]:
    """Every note, newest edit first, with a preview instead of the body."""
    notes = []
    for note in _fetch("/notes"):
        body = _plain(note.get("content", ""))
        preview = body[:160].replace("\n", " ")
        notes.append(
            {
                "id": note["id"],
                # The editor lets a note stay untitled, so the preview is
                # sometimes the only thing identifying it.
                "title": note.get("title") or "(untitled)",
                "preview": preview + ("..." if len(body) > len(preview) else ""),
                "characters": len(body),
                "updated_at": note.get("updated_at"),
            }
        )
    return notes


def read_notes(note_ids: list[int]) -> list[dict]:
    """Full text of the given notes. Ids come from list_notes."""
    read = []
    for note_id in note_ids:
        try:
            note = _fetch(f"/notes/{note_id}")
        except httpx.HTTPStatusError as error:
            if error.response.status_code == 404:
                # Reported rather than raised: one bad id should not lose the
                # notes that were found.
                read.append({"id": note_id, "error": "no note with that id"})
                continue
            raise

        read.append(
            {
                "id": note["id"],
                "title": note.get("title") or "(untitled)",
                "content": _plain(note.get("content", "")),
                "updated_at": note.get("updated_at"),
            }
        )
    return read
