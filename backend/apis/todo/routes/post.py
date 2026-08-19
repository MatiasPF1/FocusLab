'''
To-Do note routing resources - POST.

Creating a note. Unlike a queue, a blank note is fine: the user names and
writes it after opening it.

The other verbs live beside this file in apis/todo/routes/.
The router and the shared plumbing they all use live in apis/todo/core.py.
'''

from fastapi import Depends
from sqlmodel import Session

from models_ToDo import Note, NoteCreate, NoteRead
from database import get_session
from apis.todo.core import router


##########
# Routed Resources
##########

'''
/notes   --> (Creates a new note, blank unless the client sends a title/content)
'''


##########
# Routes
##########

@router.post("", response_model=NoteRead, status_code=201)
def create_note(
    payload: NoteCreate,
    session: Session = Depends(get_session),
):
    '''
    1-Build the new note row - unlike a queue, a blank note is fine, the user
      names and writes it after opening it
    2-Save it to the database
    3-Return the created note (now with its id, created_at and updated_at filled in)
    '''
    #1-)
    note = Note(title=payload.title, content=payload.content)
    #2-)Persist the new row
    session.add(note)
    session.commit()
    session.refresh(note)
    #3-)Return the saved note
    return note
