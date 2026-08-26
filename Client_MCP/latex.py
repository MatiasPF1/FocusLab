"""
Turning one notebook page into LaTeX.

Not an agent: no tools, no MCP server, no conversation. One page of HTML goes
to Claude, one LaTeX document comes back, and nothing is remembered. It lives
in this folder rather than in the backend because this is where the Anthropic
key already is.

The page arrives as the contentEditable HTML the Notebook editor writes, and its
pictures are usually the point of it - a shot of a code block, a diagram, a
table - so they are read rather than thrown away the way FocusLab_MCP/notes.py
throws them away.

They arrive in two shapes, depending on how the page was made. Paste a
screenshot and the browser embeds it as a base64 data URI. Paste a web page and
the browser keeps its pictures as links back to the site they came from, and
those have to be fetched before anything can be done with them. Both end up in
the same place: an image block for the model to look at, and a file beside the
document for LaTeX to include.
"""

import asyncio
import base64
import re
from html import escape, unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import NamedTuple

from anthropic import AsyncAnthropic
from dotenv import load_dotenv

from keys import require_anthropic_key

HERE = Path(__file__).parent
# The fallback, not the source of truth: the key normally comes from the
# FocusLab settings page. See keys.py.
load_dotenv(HERE / ".env")


####
# 1- Limits
####

# runs sonnet; this one wants sight and care rather than cleverness.
MODEL = "claude-sonnet-5"

# Generous: a dense page of notes plus a preamble is nowhere near this, and
# hitting the cap truncates the document mid-command.
MAX_TOKENS = 16000

# Markup, not text: an average page is a few thousand characters, so a page
# past this is either enormous or carrying something the sanitiser missed.
MAX_HTML_CHARS = 120_000

# Per request, counted in pictures actually sent to the model - so an SVG badge
# or a dead link costs nothing but the attempt. High enough for a page pasted
# off the web, which arrives carrying a logo, a row of badges and a wall of
# sponsor icons.
MAX_IMAGES = 24

# How many <img> are worth considering in the first place. Only a bound on
# absurdity: what survives is capped by MAX_IMAGES either way.
MAX_CANDIDATES = 60

# The API rejects images over 5 MB; stay clear of the edge.
MAX_IMAGE_BYTES = 3_500_000

# And a ceiling on the lot of them, so one page cannot build a request the API
# will refuse for its size.
MAX_TOTAL_IMAGE_BYTES = 20_000_000

# Fetching one picture the page points at. Short: a page waiting on a slow host
# is worse than a page missing one picture.
FETCH_TIMEOUT = 12

# How many of those at once.
FETCH_AT_ONCE = 6


####
# 2- Preparing the page
####

# Tags that survive into what the model reads. Anything else is dropped and its
# text kept, so an unexpected wrapper never costs a sentence.
_KEPT = {
    "p", "div", "br", "span", "font",
    "b", "strong", "i", "em", "u", "s", "strike", "sub", "sup",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "blockquote", "pre", "code", "a", "hr",
    "table", "thead", "tbody", "tr", "td", "th",
}

# Tags whose text is markup rather than content.
_SKIPPED = {"script", "style"}

# No closing tag to emit.
_VOID = {"br", "hr"}

# Everything else - class, width, data-* - is noise to the model. `style` stays
# because that is where the editor puts text colour.
_KEPT_ATTRS = {
    "a": {"href"},
    "font": {"color"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan"},
}

_DATA_URI = re.compile(r"^data:(image/(?:png|jpe?g|gif|webp));base64,(.+)$", re.I | re.S)

# What LaTeX reads straight off disk. A GIF or a WebP is converted to PNG on
# its way into the compile directory (see pdf.py), so it is named .png here.
_EXTENSIONS = {"image/png": "png", "image/jpeg": "jpg"}

# What the model can be shown. SVG is in neither this list nor LaTeX's, so a
# page's SVG badges are reported as omitted rather than drawn.
_READABLE = {"image/png", "image/jpeg", "image/gif", "image/webp"}

'''
Where a picture stands in the page while it is still being worked out.

An <img> is written into the HTML as one of these tokens rather than its final
[IMAGE n], because n is not known yet: a picture the page links to might turn
out to be unreachable, an SVG, or too big, and the numbering has to close over
the gap. _fill_markers swaps them for the real thing once that is settled.
'''
_SLOT = "\n[[IMAGE:{}]]\n"
_SLOT_PATTERN = re.compile(r"\[\[IMAGE:(\d+)\]\]")
_MISSING = "\n[IMAGE - not available]\n"


class _Sanitiser(HTMLParser):
    """HTML in, smaller HTML out, with the pictures lifted off to one side.

    Structure is deliberately kept - <h2>, <b>, a colour on a <span> - because
    that is what the LaTeX has to reproduce. What goes is the weight: script
    and style bodies, every attribute the model cannot use, and the megabytes
    of base64 an <img> carries.
    """

    def __init__(self):
        super().__init__()
        self._parts: list[str] = []
        self._skipping = 0
        # One per picture worth trying, in the order they appear. Either it
        # arrived with its bytes - {"media_type", "data"} - or it is a link to
        # go and fetch - {"url"}. _resolve turns the second into the first, or
        # gives up on it.
        self.candidates: list[dict] = []

    def _attrs(self, tag, attrs):
        keep = _KEPT_ATTRS.get(tag, set()) | {"style"}
        out = ""
        for name, value in attrs:
            if name in keep and value:
                out += ' {}="{}"'.format(name, escape(value, quote=True))
        return out

    def _image(self, attrs):
        """Put a slot where the picture is, and note how to get hold of it.

        Two kinds of <img> reach here, and the difference is how the page was
        made. Paste a screenshot and the browser embeds it, bytes and all, as a
        data: URI. Paste a web page and the browser keeps the pictures as links
        back to wherever they came from - so those have to be fetched, which is
        _resolve's job, not this one's.

        A picture that is neither, or one past the per-request count, still
        leaves a marker behind: the model is told something was there, which
        beats the page silently losing a step.
        """
        src = (dict(attrs).get("src") or "").strip()

        if len(self.candidates) >= MAX_CANDIDATES:
            self._parts.append(_MISSING)
            return

        match = _DATA_URI.match(src)
        if match:
            media_type, payload = match.group(1).lower(), match.group(2)
            if media_type == "image/jpg":
                media_type = "image/jpeg"
            try:
                raw = base64.b64decode(payload, validate=True)
            except Exception:
                self._parts.append(_MISSING)
                return
            if len(raw) > MAX_IMAGE_BYTES:
                self._parts.append("\n[IMAGE - too large to read]\n")
                return
            self.candidates.append({"media_type": media_type, "data": payload, "bytes": len(raw)})
            self._parts.append(_SLOT.format(len(self.candidates) - 1))
            return

        if src.lower().startswith(("http://", "https://")):
            self.candidates.append({"url": src})
            self._parts.append(_SLOT.format(len(self.candidates) - 1))
            return

        # A blob: URL from a browser that never embedded it, or a relative path
        # to something only that page could see. Nothing to go and get.
        self._parts.append(_MISSING)

    def handle_starttag(self, tag, attrs):
        if tag in _SKIPPED:
            self._skipping += 1
        elif tag == "img":
            self._image(attrs)
        elif tag in _KEPT:
            self._parts.append("<{}{}>".format(tag, self._attrs(tag, attrs)))

    def handle_startendtag(self, tag, attrs):
        # <img/> and <br/> - a start tag that never gets an end tag.
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag in _SKIPPED and self._skipping:
            self._skipping -= 1
        elif tag in _KEPT and tag not in _VOID:
            self._parts.append("</{}>".format(tag))

    def handle_data(self, data):
        if not self._skipping:
            # convert_charrefs is on, so entities arrive decoded. Re-escaping
            # them keeps what the model reads valid HTML.
            self._parts.append(escape(data, quote=False))

    def html(self) -> str:
        return "".join(self._parts).strip()


def _prepare(html: str) -> tuple[str, list[dict]]:
    """The page's HTML stripped down, with a slot per picture worth having."""
    parser = _Sanitiser()
    parser.feed(html or "")
    parser.close()
    return parser.html(), parser.candidates


####
# 2.1- Pictures the page only links to
####

# Some hosts refuse a request with no user agent, or serve something different
# to one. Ask the way the browser showing this page already asked.
_FETCH_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
}


def _sniff(raw: bytes) -> str:
    """What a picture actually is, from its first bytes.

    Servers get Content-Type wrong often enough - and CDNs serve
    application/octet-stream often enough - that the header is a hint rather
    than an answer.
    """
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if raw.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if raw.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    if b"<svg" in raw[:2048].lower():
        # Readable by neither the API nor the typesetter.
        return "image/svg+xml"
    return ""


async def _fetch(client, candidate: dict) -> None:
    """Go and get one linked picture, or quietly leave it unfetched.

    Every failure is the same failure as far as the page is concerned: no
    bytes, so the picture is reported as unavailable and the rest of the
    conversion carries on. A note is not worth failing over a dead logo.
    """
    try:
        response = await client.get(candidate["url"])
        response.raise_for_status()
    except Exception:
        return

    raw = response.content
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        return

    media_type = _sniff(raw) or response.headers.get("content-type", "").split(";")[0].strip().lower()
    if media_type not in _READABLE:
        return

    candidate["media_type"] = media_type
    candidate["data"] = base64.b64encode(raw).decode()
    candidate["bytes"] = len(raw)


async def _resolve(candidates: list[dict]) -> list[dict]:
    """Fill in every picture the page only linked to, and number the survivors.

    What comes back is the pictures that are actually in hand, in page order,
    each with the file name the model will be told to use. A candidate that
    could not be fetched keeps no number - the numbering closes over the gap so
    the model is never given a name pointing at nothing.
    """
    pending = [candidate for candidate in candidates if "data" not in candidate]
    if pending:
        import httpx

        gate = asyncio.Semaphore(FETCH_AT_ONCE)

        async def one(client, candidate):
            async with gate:
                await _fetch(client, candidate)

        async with httpx.AsyncClient(
            timeout=FETCH_TIMEOUT, follow_redirects=True, headers=_FETCH_HEADERS
        ) as client:
            await asyncio.gather(*(one(client, c) for c in pending))

    images: list[dict] = []
    total = 0
    for candidate in candidates:
        if "data" not in candidate:
            continue
        # One page cannot build a request the API would refuse for its size.
        total += candidate.get("bytes", 0)
        # The two ceilings that decide what is actually sent: how many, and how
        # much. Whatever is past either keeps no number and is reported to the
        # model as unavailable.
        if len(images) >= MAX_IMAGES or total > MAX_TOTAL_IMAGE_BYTES:
            break
        candidate["number"] = len(images) + 1
        candidate["file"] = "IMAGE_{}.{}".format(
            candidate["number"], _EXTENSIONS.get(candidate["media_type"], "png")
        )
        images.append(candidate)
    return images


def _fill_markers(html: str, candidates: list[dict]) -> str:
    """Swap each slot for the marker the model reads.

    A picture that made it gets its number, and every other one says plainly
    that it is not there - which the prompt turns into % [image omitted].
    """

    def marker(match):
        candidate = candidates[int(match.group(1))]
        number = candidate.get("number")
        return "[IMAGE {}]".format(number) if number else "[IMAGE - not available]"

    return _SLOT_PATTERN.sub(marker, html)


_TAGS = re.compile(r"<[^>]+>")


def _blank(html: str) -> bool:
    """Whether a page has anything on it once the tags come off.

    An emptied page is never an empty string: contentEditable leaves <p><br></p>
    behind, which would otherwise be sent off and come back as a document made
    of nothing.
    """
    return not unescape(_TAGS.sub(" ", html)).replace("\xa0", " ").strip()


####
# 3- The instruction
####

# Raw string: nearly every line of it is backslashes.
SYSTEM = r"""
You convert one page of a student's notes into LaTeX.

This is a TRANSCRIPTION, not a rewrite. The result has to be the same page in
another format: same sections in the same order, the same sentences, the same
emphasis, the same code, the same examples. Someone holding both should not be
able to point at a line in one that is missing from the other.

YOU FIX, EVERY TIME
  - spelling, punctuation, capitalisation and grammar. Every mistake, not the
    ones you happen to notice: these are notes typed in a hurry during a class,
    and the LaTeX is the fair copy. Correct them silently - no comment, no
    marking, no mention that anything was wrong.
  - a missing word where a sentence does not parse without it
  - notation the writer typed in plain text, set as real math: x^2 -> $x^{2}$,
    <= -> $\leq$, -> -> $\to$, alpha -> $\alpha$, sqrt(n) -> $\sqrt{n}$
  - the same inside a picture you are transcribing - prose in a screenshot gets
    the same corrections. Code does NOT: transcribe code exactly as written,
    typos, odd spacing and all. A "fixed" identifier is a broken program.

YOU MAY NOT
  - add a section, a definition, an example, an explanation or a remark the
    page does not contain
  - remove anything, including a line that looks unfinished - transcribe it
  - reorder, merge or split the writer's points
  - rewrite a sentence that is already correct, or improve its style
  - write about the notes. You are setting them, not commenting on them, so no
    introduction, no summary, no "in this section we will".

Keep the writer's own language, shorthand and abbreviations. If the page is not
in English, the LaTeX is not in English either.

THE INPUT
The page comes as the HTML of a rich-text editor. Read it as structure:

  <h1> <h2> <h3> <h4>    \section \subsection \subsubsection \paragraph
  <b> <strong>           \textbf
  <i> <em>               \textit
  <u>                    \underline
  <ul> <ol> <li>         itemize / enumerate
  <blockquote>           quote
  <a href="...">         \href
  <table>                tabular
  style="color: #RRGGBB" \textcolor[HTML]{RRGGBB}
  <p> <div>              a paragraph; a blank line between them
  <br>                   a line break inside a paragraph: \\

Colour carries meaning on a page of notes - it is what the writer marked out -
so keep every colour that is on the text. The editor writes colours as rgb(...)
or #rrggbb; convert either to the six uppercase hex digits \textcolor wants.

PICTURES
[IMAGE n] in the HTML marks where a picture sits on the page, and that picture
is attached to this request as image number n, together with the file name it
has beside the document. Look at it, and then take ONE of two routes.

  1. It is a picture OF TEXT - a screenshot of code, a table, a formula, a
     paragraph, a terminal. Transcribe what it says, in its place:
       - code -> a lstlisting in that language, character for character,
         comments and all
       - a table -> tabular.  A formula -> displayed math.  Text -> that text
     Set it, do not include it. A screenshot of code that stays a picture is
     the thing this whole conversion exists to avoid.

  2. It is a picture of anything else - a diagram, a graph, a drawing, a photo,
     a screenshot of an interface. Put the picture itself in, at the point it
     sits on the page:

         \begin{figure}[h]
           \centering
           \includegraphics[width=0.85\linewidth]{IMAGE_1.png}
         \end{figure}

     Use the file name you were given for that image, exactly - the file is in
     the same directory as the document. Load graphicx when you use one. Give
     it a \caption only if the page itself captioned it; these are notes, not a
     paper, so do not invent one.

A logo, a badge, an icon or a screenshot of an interface is route 2, even
though there are words in it. Nobody wants the word "FastAPI" where the logo
was, or "build passing" where the badge was - those are pictures that happen to
contain letters. Route 1 is for a picture whose POINT is its text: code, a
table, a formula, a paragraph.

When it is genuinely both - a diagram with a line of code in it - include the
picture. Never do both for one image.

[IMAGE - not available] and [IMAGE - too large to read] have no file and no
picture attached: they become % [image omitted] and nothing else.

ESCAPING
The characters # $ % & _ { } are literal text in prose and must be escaped:
size_t is size\_t, 100% is 100\%. Use \textbackslash{} for a backslash and
\textasciitilde{} \textasciicircum{} for ~ and ^. Inside lstlisting they are
already literal - do not escape there.

THE DOCUMENT
Return one complete document that compiles with pdflatex as it stands:

  \documentclass[11pt]{article}
  \usepackage[utf8]{inputenc}
  \usepackage[T1]{fontenc}
  \usepackage[margin=1in]{geometry}
  \usepackage{amsmath, amssymb}
  \usepackage{xcolor}
  \usepackage{listings}
  \usepackage{graphicx}
  \usepackage{hyperref}

Add a package only if you use it, and drop one you do not. When there is code,
configure listings once in the preamble so it wraps and does not run off the
page, and turn line numbers on if the screenshot you took it from had them.
Define colours with \definecolor or use \textcolor[HTML]{...} directly.

Two things that quietly add what the page does not say:

  - \maketitle prints today's date unless you stop it. The page has no date on
    it, so always write \date{} in the preamble. Use a date only if the writer
    put one on the page, and then use theirs.
  - The writer numbers their own headings - "0 - Primitive Types", "1 -
    Pointers And Memory". Use the starred forms, \section*, \subsection*,
    \paragraph*, so LaTeX does not print a second number in front of theirs.
    Starred all the way down, even where a heading has no number of its own:
    what matters is that the numbering on the page stays the page's.

OUTPUT
LaTeX source and nothing else. No markdown fence, no sentence before it, no
note after it. The first characters of your reply are \documentclass.
"""


####
# 4- The call
####

_client = None


def _anthropic() -> AsyncAnthropic:
    """Built on first use, so importing this module never needs a key."""
    global _client
    if _client is None:
        # The key the user saved in FocusLab, falling back to this folder's
        # .env. See keys.py for why the app wins over the file.
        _client = AsyncAnthropic(api_key=require_anthropic_key())
    return _client


def _text(message) -> str:
    """The reply's text blocks, joined.

    A response can also carry thinking blocks, which have no .text to read.
    """
    return "".join(
        block.text for block in message.content if block.type == "text"
    ).strip()


# Belt and braces: the prompt says no fences, but one slipping through would
# land in the user's .tex file.
_FENCE = re.compile(r"^```(?:latex|tex)?\n(.*)\n```$", re.S)


def _unfenced(source: str) -> str:
    match = _FENCE.match(source.strip())
    return match.group(1).strip() if match else source


def _where(title: str, page: int, page_count: int) -> str:
    """One line telling the model which page of what it is looking at.

    The title belongs to the entry rather than to the page, so only the first
    page is allowed to open with it - the rest carry on from where it left off.
    """
    heading = title.strip()
    if page > 1:
        named = ' titled "{}"'.format(heading) if heading else ""
        return (
            "This is page {} of {} of an entry{}. It continues from the page "
            "before, so do not repeat the title and do not restate what came "
            "earlier - set this page only.".format(page, page_count, named)
        )
    if heading:
        return (
            'This is page 1 of {} of an entry titled "{}". Use that title with '
            "\\title and \\maketitle.".format(page_count, heading)
        )
    return (
        "This is page 1 of {} of an untitled entry. There is no title to set, "
        "so start at the first thing on the page.".format(page_count)
    )


class Conversion(NamedTuple):
    """A converted page: the document, and the pictures it may point at.

    The images travel with the source because a document that includes one
    cannot be compiled without it - pdf.py writes each into the directory it
    compiles in, under the `file` name the model was told to use.
    """

    source: str
    images: list[dict]


async def to_latex(
    html: str, title: str = "", page: int = 1, page_count: int = 1
) -> Conversion:
    """One page of editor HTML as a compilable LaTeX document.

    Raises ValueError for a page the user can do something about - an empty
    one, or one too long to send - and lets everything else surface as itself.
    """
    clean, candidates = _prepare(html)
    if not candidates and _blank(clean):
        raise ValueError("There is nothing on this page to convert.")
    if len(clean) > MAX_HTML_CHARS:
        raise ValueError(
            "This page is too long to convert in one go. Split it across two "
            "pages and convert each."
        )

    # Anything the page only linked to is fetched here, before the markers can
    # be numbered: what is unreachable never gets a number.
    images = await _resolve(candidates)
    clean = _fill_markers(clean, candidates)

    content: list[dict] = []
    if images:
        # Each picture is announced by the same marker that stands in its place
        # in the HTML below, so the model can put them back where they belong.
        content.append(
            {
                "type": "text",
                "text": (
                    "The {} picture(s) on this page, in order. Each is named by "
                    "the file it has beside the document, for when you include "
                    "it rather than transcribe it.".format(len(images))
                ),
            }
        )
        for number, image in enumerate(images, start=1):
            content.append(
                {
                    "type": "text",
                    "text": "[IMAGE {}] - file: {}".format(number, image["file"]),
                }
            )
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": image["media_type"],
                        "data": image["data"],
                    },
                }
            )

    content.append(
        {
            "type": "text",
            "text": "{}\n\nThe page:\n\n{}".format(_where(title, page, page_count), clean),
        }
    )

    message = await _anthropic().messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM,
        messages=[{"role": "user", "content": content}],
    )

    source = _unfenced(_text(message))
    if not source:
        raise RuntimeError("Claude returned an empty document.")
    return Conversion(source, images)


####
# 5- When it will not compile
####

REPAIR = r"""
You fix LaTeX documents that failed to compile.

You are given the source and the tail of the engine's log. Return the same
document with the errors fixed and NOTHING else changed: same words, same
sections, same order, same content. This is a repair, not a revision - the
document is somebody's page of notes and its text is not yours to touch.

Usual causes: an unescaped # $ % & _ { }, a package used but not loaded, a
begin without its end, a stray character after \\, a command that does not
exist, math outside math mode.

Reply with the whole corrected document and nothing else. No markdown fence,
no explanation. The first characters of your reply are \documentclass.
"""


async def repair(source: str, log: str) -> str:
    """One attempt at making a document compile, changing as little as possible."""
    message = await _anthropic().messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=REPAIR,
        messages=[
            {
                "role": "user",
                "content": "The log:\n\n{}\n\nThe document:\n\n{}".format(log, source),
            }
        ],
    )

    fixed = _unfenced(_text(message))
    if not fixed:
        raise RuntimeError("Claude returned an empty document.")
    return fixed
