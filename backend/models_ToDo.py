from datetime import datetime
from sqlalchemy import Column, Text
from sqlmodel import SQLModel, Field


#PK: Primary Key

##########
# Model For To-Do Notes
##########

#                                    Colummns Construction
#   ┌──────────────────────────────┐
#   │             NOTE             │
#   ├──────────────┬─────────────┬─┤
#   │ int          │ id          │PK│ "which note is this?"
#   │ string       │ title       │  │ "what is this note called?"
#   │ string       │ content     │  │ "the note body, saved as HTML from the rich-text editor"
#   │ datetime     │ created_at  │  │ "when was this note first made?"
#   │ datetime     │ updated_at  │  │ "when was this note last edited?"
#   └──────────────┴─────────────┴──┘

#                                            Example
#   ┌──────────────────────────────────────────────────────────────────────────────────────┐
#   │                                       note table                                       │
#   ├────┬──────────────────┬──────────────────────────────┬───────────────────┬─────────────┤
#   │ id │ title            │ content                       │ created_at        │ updated_at  │
#   ├────┼──────────────────┼──────────────────────────────┼───────────────────┼─────────────┤
#   │ 1  │ Research for Me  │ <h2>Stevens tech</h2><p>...</p>│ 2026-08-06 14:00  │ 2026-08-13  │
#   └────┴──────────────────┴──────────────────────────────┴───────────────────┴─────────────┘

class Note(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str = ""
    # Rich-text HTML from the To-Do note editor, unbounded so long notes are never truncated.
    content: str = Field(default="", sa_column=Column(Text))
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

class NoteCreate(SQLModel):
    '''
    A brand new note starts blank - the user names and writes it after opening it -
    so both fields are optional here, unlike QueueCreate which requires a name.
    '''
    title: str = ""
    content: str = ""


class NoteUpdate(SQLModel):
    '''
    Partial update: only the fields the client actually sends are changed. Both
    are optional so a title edit doesn't require resending the whole body, and
    vice versa.
    '''
    title: str | None = None
    content: str | None = None


class NoteRead(SQLModel):
    id: int
    title: str
    content: str
    created_at: datetime
    updated_at: datetime
