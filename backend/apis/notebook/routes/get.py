'''
Notebook routing resources - GET only.

Every route here only reads saved entries. Nothing in this file creates,
changes or deletes anything.

The routes that DO change entries live beside this file in
apis/notebook/routes/post.py, patch.py and delete.py.
The router and the shared plumbing they all use live in apis/notebook/core.py.
'''

from fastapi import Depends
from sqlmodel import Session, select

from fastapi import HTTPException

from models.notebook import NotebookEntry, NotebookEntryRead, NotebookLatexRead
from database import get_session
from apis.notebook.core import (
    get_entry_or_404,
    get_stored_latex,
    read_stored_latex,
    router,
)


##########
# Routed Resources
##########

'''
/notebook                                --> (Lists every saved entry, most recently edited first)
/notebook/{entry_id}                     --> (Returns one entry)
/notebook/{entry_id}/latex/{page_index}  --> (Returns the LaTeX stored for one page)
'''


##########
# Routes
##########

@router.get("", response_model=list[NotebookEntryRead])
def list_entries(session: Session = Depends(get_session)):
    '''
    1-Ask for every entry, most recently edited first
    2-Return them as a list
    '''
    #1-)Most recently edited first, matching the card row's sort order
    entries = session.exec(
        select(NotebookEntry).order_by(NotebookEntry.updated_at.desc())
    ).all()
    #2-)Return the list
    return entries


@router.get("/{entry_id}", response_model=NotebookEntryRead)
def get_entry(
    entry_id: int,
    session: Session = Depends(get_session),
):
    '''
    1-Find the entry (404 if it doesn't exist)
    2-Return it
    '''
    #1-)+2-)
    return get_entry_or_404(session, entry_id)


@router.get("/{entry_id}/latex/{page_index}", response_model=NotebookLatexRead)
def get_entry_latex(
    entry_id: int,
    page_index: int,
    session: Session = Depends(get_session),
):
    '''
    1-Find the entry (404 if it doesn't exist)
    2-Find what was stored for that page of it
    3-Return it, or say plainly that this page has never been converted

    The Notebook asks for this every time a page is opened, so a page with
    nothing stored is the ordinary case rather than a mistake - hence a 404
    the frontend expects and quietly ignores.
    '''
    #1-)An entry that is gone is a different problem from a page never converted
    get_entry_or_404(session, entry_id)
    #2-)
    stored = get_stored_latex(session, entry_id, page_index)
    if not stored:
        raise HTTPException(
            status_code=404,
            detail="This page has not been converted yet",
        )
    #3-)
    return read_stored_latex(stored)
