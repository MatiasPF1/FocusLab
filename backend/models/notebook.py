from datetime import datetime
from sqlalchemy import Column, LargeBinary, Text, UniqueConstraint
from sqlmodel import SQLModel, Field


#PK: Primary Key

##########
# Model For Notebook Entries
##########

'''
The Notebook's own rows.

Deliberately a separate table from the To-Do note, not a shared one with a
"kind" column: the two pages are different products that happen to both hold
rich text. An entry has cover art and is written across pages; a To-Do note has
neither. Sharing one table meant every note showed up in both places and an
edit on one page moved the other, which is exactly what this table ends.

Nothing here is imported by apis/todo/, and nothing in models/todo.py is
imported here. That is the point - one can grow a column without the other
noticing.
'''

#                                    Colummns Construction
#   ┌────────────────────────────────┐
#   │        NOTEBOOK_ENTRY          │
#   ├──────────────┬─────────────┬───┤
#   │ int          │ id          │PK │ "which entry is this?"
#   │ string       │ title       │   │ "what is this entry called?"
#   │ string       │ content     │   │ "the entry body, HTML, all of its pages in one string"
#   │ string       │ cover       │   │ "which cover art the card and the header show"
#   │ datetime     │ created_at  │   │ "when was this entry first made?"
#   │ datetime     │ updated_at  │   │ "when was this entry last edited?"
#   └──────────────┴─────────────┴───┘
#
#   There is no `pages` column. An entry's pages live inside `content`,
#   separated by a sentinel <hr> the frontend writes - see the frontend's
#   Notebook_Components/pages.ts for why they are stored that way.

class NotebookEntry(SQLModel, table=True):
    # Spelled out rather than left to SQLModel's lowercased class name, since
    # the copy in database.py names this table in raw SQL.
    __tablename__ = "notebook_entry"

    id: int | None = Field(default=None, primary_key=True)
    title: str = ""
    # Rich-text HTML from the Notebook editor, unbounded so a long entry - one
    # carrying pasted screenshots as base64 - is never truncated.
    content: str = Field(default="", sa_column=Column(Text))
    # An id from the frontend's cover catalogue ("cover1") rather than a path,
    # so moving or renaming the image files never invalidates what is stored
    # here. Empty means no cover.
    cover: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


##########
# Model For A Converted Page
##########

'''
The LaTeX a page was turned into, kept so it is still there tomorrow.

A conversion costs a call to Claude and a compile, so throwing it away when the
user turns the page is expensive and rude. One row per page of an entry, holding
both halves of the result: the .tex somebody may want to paste into Overleaf,
and the PDF that was compiled from it, so re-opening a page never re-renders
anything.

WHY A SEPARATE TABLE
An entry keeps all of its pages in one `content` string, so there is nowhere on
notebook_entry to hang a per-page anything. This table is that somewhere, keyed
by which page it was.

WHEN IT GOES STALE
page_hash is a fingerprint of the page's HTML as it was when this was made. The
frontend fingerprints the page it is showing and compares: different means the
page has been edited since, and what is stored describes an older version of it.
That is shown, not hidden and not deleted - an out of date transcription is
still worth reading, and the user decides whether to spend another conversion.
Deleting a page shifts the pages after it into new indexes, and the hash is what
catches that too.
'''

#                                    Colummns Construction
#   ┌──────────────────────────────────┐
#   │          NOTEBOOK_LATEX          │
#   ├──────────────┬─────────────┬─────┤
#   │ int          │ id          │ PK  │ "which stored conversion is this?"
#   │ int          │ entry_id    │ FK  │ "which notebook entry does it belong to?"
#   │ int          │ page_index  │     │ "which page of that entry, counting from 0"
#   │ string       │ source      │     │ "the .tex document itself"
#   │ bytes|None   │ pdf         │     │ "the compiled PDF, or nothing if it would not compile"
#   │ string       │ page_hash   │     │ "fingerprint of the page this was made from"
#   │ datetime     │ created_at  │     │ "when was this page first converted?"
#   │ datetime     │ updated_at  │     │ "when was this conversion last replaced?"
#   └──────────────┴─────────────┴─────┘

class NotebookLatex(SQLModel, table=True):
    __tablename__ = "notebook_latex"
    # One conversion per page: converting again replaces what is there rather
    # than leaving two rows to choose between.
    __table_args__ = (UniqueConstraint("entry_id", "page_index"),)

    id: int | None = Field(default=None, primary_key=True)
    entry_id: int = Field(foreign_key="notebook_entry.id", index=True)
    page_index: int = 0
    source: str = Field(default="", sa_column=Column(Text))
    # The PDF as it came off the typesetter. Null when the document would not
    # compile - the source is kept anyway, it is the half that took the work.
    pdf: bytes | None = Field(default=None, sa_column=Column(LargeBinary))
    page_hash: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


##########
# Schemas (NOT tables) - shapes the API accepts and returns
##########

'''
The table model above describes what the database stores.
The schemas below describe what a request may send and what a response gives back,
so clients can never set things like id, created_at or updated_at themselves.
'''

class NotebookEntryCreate(SQLModel):
    '''
    A brand new entry starts blank - the user names and writes it after opening
    it - so every field is optional.
    '''
    title: str = ""
    content: str = ""
    cover: str = ""


class NotebookEntryUpdate(SQLModel):
    '''
    Partial update: only the fields the client actually sends are changed, so a
    title edit doesn't require resending the body, and picking a cover doesn't
    touch either.
    '''
    title: str | None = None
    content: str | None = None
    cover: str | None = None


class NotebookEntryRead(SQLModel):
    id: int
    title: str
    content: str
    cover: str
    created_at: datetime
    updated_at: datetime


class NotebookLatexSave(SQLModel):
    '''
    What the Notebook sends once a conversion comes back.

    The PDF travels as base64 because this is JSON, and is optional because a
    document that would not compile still has a source worth keeping.
    '''
    source: str
    pdf: str | None = None
    page_hash: str = ""


class NotebookLatexRead(SQLModel):
    '''
    What the pane reads back when a page is opened.

    page_hash comes back so the frontend can fingerprint the page it is showing
    and see whether this was made from it or from an older version of it.
    '''
    entry_id: int
    page_index: int
    source: str
    pdf: str | None
    page_hash: str
    created_at: datetime
    updated_at: datetime
