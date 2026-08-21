"""
Compiling a LaTeX document into a PDF.

The other half of the Notebook's output pane: latex.py writes the .tex, this
runs it through Tectonic and hands back the bytes the browser shows. Nothing
here talks to Claude.

Tectonic is a single static binary installed in the image (see the Dockerfile),
and it is given --untrusted: the document being compiled was written by a model
a moment ago, so shell-escape and reading files outside the working directory
stay off. Each compile happens in a temporary directory that is deleted with
its .tex, .pdf, .log and everything else the run left behind.
"""

import asyncio
import base64
import io
import shutil
import tempfile
from pathlib import Path

# Long enough for a cold cache to fetch a package the warm-up compile did not
# cover, short enough that a document looping on itself does not hang the pane.
TIMEOUT_SECONDS = 120

# What is shown when a compile fails. The interesting part of a LaTeX log is
# always at the end.
LOG_TAIL_CHARS = 1200


class CompileError(Exception):
    """A document Tectonic would not compile, carrying the end of its log."""

    def __init__(self, log: str):
        super().__init__(log)
        self.log = log


def available() -> bool:
    """Whether there is a Tectonic to call at all."""
    return shutil.which("tectonic") is not None


# What the engine can read off disk. Anything else is converted on the way in.
_NATIVE = {"image/png", "image/jpeg"}


def _write_images(work: Path, images) -> None:
    """Put each picture beside the document, under the name it was promised.

    The model was told these file names when it wrote the document, so an
    \\includegraphics in there is already pointing at them. A picture it chose
    to transcribe instead simply leaves its file unused, which costs nothing.

    A GIF or a WebP is converted to PNG: the API will read those formats but
    the typesetting engine will not.
    """
    for image in images:
        raw = base64.b64decode(image["data"])
        if image["media_type"] not in _NATIVE:
            try:
                from PIL import Image

                buffer = io.BytesIO()
                Image.open(io.BytesIO(raw)).convert("RGBA").save(buffer, format="PNG")
                raw = buffer.getvalue()
            except Exception:
                # No file written. The document only breaks if the model chose
                # to include this one, and the repair pass sees the missing
                # file in the log and takes the \includegraphics back out.
                continue
        (work / image["file"]).write_bytes(raw)


def _tail(output: bytes) -> str:
    text = output.decode("utf-8", errors="replace").strip()
    if len(text) <= LOG_TAIL_CHARS:
        return text
    return "..." + text[-LOG_TAIL_CHARS:]


async def to_pdf(source: str, images=()) -> bytes:
    """One LaTeX document in, one PDF out.

    `images` are the pictures from the page the document was written from, in
    the shape latex.py hands back. They are written into the compile directory
    so an \\includegraphics resolves; a document with none is unaffected.

    Raises CompileError with the tail of the log when the document does not
    compile - that log is what the repair pass in latex.py reads.
    """
    if not available():
        raise CompileError(
            "No LaTeX engine in this container. Rebuild the agent image: "
            "docker compose build agent"
        )

    with tempfile.TemporaryDirectory(prefix="focuslab-latex-") as work:
        tex = Path(work) / "page.tex"
        tex.write_text(source, encoding="utf-8")
        _write_images(Path(work), images)

        process = await asyncio.create_subprocess_exec(
            "tectonic",
            "-X",
            "compile",
            "--untrusted",
            "--outfmt",
            "pdf",
            "page.tex",
            cwd=work,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            _, errors = await asyncio.wait_for(
                process.communicate(), timeout=TIMEOUT_SECONDS
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise CompileError(
                f"The document took longer than {TIMEOUT_SECONDS}s to compile."
            )

        pdf = Path(work) / "page.pdf"
        # Tectonic can exit 0 and still write nothing if the document ends up
        # empty, so the file is what is checked rather than the status alone.
        if process.returncode != 0 or not pdf.exists():
            raise CompileError(_tail(errors) or "The document did not compile.")

        return pdf.read_bytes()
