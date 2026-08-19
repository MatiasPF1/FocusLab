'''
To-Do note routing resources - GET only.

Every route here only reads saved notes. Nothing in this file creates,
changes or deletes anything.

The routes that DO change notes live beside this file in
apis/todo/routes/post.py, patch.py and delete.py.
The router and the shared plumbing they all use live in apis/todo/core.py.
'''

from fastapi import Depends
from sqlmodel import Session, select

from models_ToDo import Note, NoteRead
from database import get_session
from apis.todo.core import get_note_or_404, router


##########
# Routed Resources
##########

'''
/notes           --> (Lists every saved note, most recently edited first)
/notes/{note_id} --> (Returns one note)
'''


##########
# Routes
##########

@router.get("", response_model=list[NoteRead])
def list_notes(session: Session = Depends(get_session)):
    '''
    1-Ask for every note, most recently edited first
    2-Return them as a list
    '''
    #1-)Most recently edited first, matching the card grid's sort order
    notes = session.exec(
        select(Note).order_by(Note.updated_at.desc())
    ).all()
    #2-)Return the list
    return notes


@router.get("/{note_id}", response_model=NoteRead)
def get_note(
    note_id: int,
    session: Session = Depends(get_session),
):
    '''
    1-Find the note (404 if it doesn't exist)
    2-Return it
    '''
    #1-)+2-)
    return get_note_or_404(session, note_id)
