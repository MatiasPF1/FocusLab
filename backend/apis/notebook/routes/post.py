'''
Notebook routing resources - POST.

Creating an entry. A blank one is fine: the user names and writes it after
opening it, and picks its cover whenever they feel like it.

The other verbs live beside this file in apis/notebook/routes/.
The router and the shared plumbing they all use live in apis/notebook/core.py.
'''

from fastapi import Depends
from sqlmodel import Session

from models.notebook import NotebookEntry, NotebookEntryCreate, NotebookEntryRead
from database import get_session
from apis.notebook.core import router


##########
# Routed Resources
##########

'''
/notebook   --> (Creates a new entry, blank unless the client sends something)
'''


##########
# Routes
##########

@router.post("", response_model=NotebookEntryRead, status_code=201)
def create_entry(
    payload: NotebookEntryCreate,
    session: Session = Depends(get_session),
):
    '''
    1-Build the new entry row - a blank one is fine, the user names and writes
      it after opening it
    2-Save it to the database
    3-Return the created entry (now with its id, created_at and updated_at filled in)
    '''
    #1-)
    entry = NotebookEntry(
        title=payload.title,
        content=payload.content,
        cover=payload.cover,
    )
    #2-)Persist the new row
    session.add(entry)
    session.commit()
    session.refresh(entry)
    #3-)Return the saved entry
    return entry
