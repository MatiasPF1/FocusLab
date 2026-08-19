'''
To-Do note routing resources - PATCH.

Editing a note's title and/or content, and stamping when that happened.

The other verbs live beside this file in apis/todo/routes/.
The router and the shared plumbing they all use live in apis/todo/core.py.
'''

from datetime import datetime

from fastapi import Depends
from sqlmodel import Session

from models_ToDo import NoteRead, NoteUpdate
from database import get_session
from apis.todo.core import get_note_or_404, router


##########
# Routed Resources
##########

'''
/notes/{note_id}   --> (Edits a note's title and/or content)
'''


##########
# Routes
##########

@router.patch("/{note_id}", response_model=NoteRead)
def update_note(
    note_id: int,
    payload: NoteUpdate,
    session: Session = Depends(get_session),
):
    '''
    1-Find the note (404 if it doesn't exist)
    2-Apply only the fields the client actually sent
    3-Stamp the edit time and save
    4-Return the updated note
    '''
    #1-)Make sure the note exists before changing anything
    note = get_note_or_404(session, note_id)
    #2-)exclude_unset so an edit to just the title doesn't blank out the content, and vice versa
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(note, field, value)
    #3-)Every edit - even one that changes nothing - counts as touching the note
    note.updated_at = datetime.utcnow()
    session.add(note)
    session.commit()
    session.refresh(note)
    #4-)Return the updated note
    return note
