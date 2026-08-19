'''
To-Do note routing resources - DELETE.

Removing a note. A note owns nothing else, so nothing has to be cleaned up
first the way a queue's songs do.

The other verbs live beside this file in apis/todo/routes/.
The router and the shared plumbing they all use live in apis/todo/core.py.
'''

from fastapi import Depends
from sqlmodel import Session

from database import get_session
from apis.todo.core import get_note_or_404, router


##########
# Routed Resources
##########

'''
/notes/{note_id}   --> (Deletes a note)
'''


##########
# Routes
##########

@router.delete("/{note_id}", status_code=204)
def delete_note(
    note_id: int,
    session: Session = Depends(get_session),
):
    '''
    1-Find the note (404 if it doesn't exist)
    2-Delete it
    '''
    #1-)Make sure the note exists before deleting it
    note = get_note_or_404(session, note_id)
    #2-)
    session.delete(note)
    session.commit()
    #204 No Content means success with nothing to return
