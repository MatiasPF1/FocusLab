'''
To-Do notes.

The base of everything note related. Two things live here:

  1. The router itself, which every file in routes/ attaches its routes to.
  2. The plumbing they share.
'''

from fastapi import APIRouter, HTTPException
from sqlmodel import Session

from models_ToDo import Note


##########
# Router
##########

'''
Declared once here and imported by both route files, so every note route shares
one prefix and one tag no matter which file it is written in.
'''
router = APIRouter(
    prefix="/notes",    #localhost....8000/notes + routes designed
    tags=["To-Do Notes"],
)


####
# Getters or Helper Functions
####

def get_note_or_404(session: Session, note_id: int) -> Note:
    '''
    1-Look the note up by its primary key
    2-Stop the request with a clear 404 if it doesn't exist
    3-Return the note to the caller
    '''
    #1-)Fetch the note row
    note = session.get(Note, note_id)
    #2-)Every route that uses this needs a real note, so fail loudly when it's missing
    if not note:
        raise HTTPException(
            status_code=404,
            detail="Note not found",
        )
    #3-)Hand the note back to whichever route called this
    return note
