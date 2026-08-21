'''
Notebook routing resources - PATCH.

Editing an entry's title, body or cover, and stamping when that happened.

The other verbs live beside this file in apis/notebook/routes/.
The router and the shared plumbing they all use live in apis/notebook/core.py.
'''

from datetime import datetime

from fastapi import Depends
from sqlmodel import Session

from models.notebook import NotebookEntryRead, NotebookEntryUpdate
from database import get_session
from apis.notebook.core import get_entry_or_404, router


##########
# Routed Resources
##########

'''
/notebook/{entry_id}   --> (Edits an entry's title, body and/or cover)
'''


##########
# Routes
##########

@router.patch("/{entry_id}", response_model=NotebookEntryRead)
def update_entry(
    entry_id: int,
    payload: NotebookEntryUpdate,
    session: Session = Depends(get_session),
):
    '''
    1-Find the entry (404 if it doesn't exist)
    2-Apply only the fields the client actually sent
    3-Stamp the edit time and save
    4-Return the updated entry
    '''
    #1-)Make sure the entry exists before changing anything
    entry = get_entry_or_404(session, entry_id)
    #2-)exclude_unset so an edit to just the title doesn't blank out the body, and vice versa
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(entry, field, value)
    #3-)Every edit - even one that changes nothing - counts as touching the entry
    entry.updated_at = datetime.utcnow()
    session.add(entry)
    session.commit()
    session.refresh(entry)
    #4-)Return the updated entry
    return entry
