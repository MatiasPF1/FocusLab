'''
Notebook entries.

The base of everything Notebook related. Two things live here:

  1. The router itself, which every file in routes/ attaches its routes to.
  2. The plumbing they share.

A deliberate copy of apis/todo/core.py rather than a shared module: the two
services are separate products and neither should move when the other is
changed. The only thing they have in common is the shape of the code.
'''

import base64

from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select

from models.notebook import NotebookEntry, NotebookLatex, NotebookLatexRead


##########
# Router
##########

'''
Declared once here and imported by every route file, so they all share one
prefix and one tag no matter which file they are written in.
'''
router = APIRouter(
    prefix="/notebook",    #localhost....8000/notebook + routes designed
    tags=["Notebook"],
)


####
# Getters or Helper Functions
####

def get_entry_or_404(session: Session, entry_id: int) -> NotebookEntry:
    '''
    1-Look the entry up by its primary key
    2-Stop the request with a clear 404 if it doesn't exist
    3-Return the entry to the caller
    '''
    #1-)Fetch the entry row
    entry = session.get(NotebookEntry, entry_id)
    #2-)Every route that uses this needs a real entry, so fail loudly when it's missing
    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Notebook entry not found",
        )
    #3-)Hand the entry back to whichever route called this
    return entry


def get_stored_latex(session: Session, entry_id: int, page_index: int) -> NotebookLatex | None:
    '''
    1-Look for the conversion stored against that page of that entry
    2-Hand it back, or None when the page has never been converted

    None rather than a 404 here: whether "nothing stored" is an error depends
    on the route, and for reading a page it plainly is not.
    '''
    #1-)At most one row - the table has a unique constraint on this pair
    return session.exec(
        select(NotebookLatex)
        .where(NotebookLatex.entry_id == entry_id)
        .where(NotebookLatex.page_index == page_index)
    ).first()


def read_stored_latex(stored: NotebookLatex) -> NotebookLatexRead:
    '''
    A stored conversion in the shape the API returns it.

    The PDF is bytes in the database and base64 in JSON, and this is the one
    place that difference is dealt with.
    '''
    return NotebookLatexRead(
        entry_id=stored.entry_id,
        page_index=stored.page_index,
        source=stored.source,
        pdf=base64.b64encode(stored.pdf).decode() if stored.pdf else None,
        page_hash=stored.page_hash,
        created_at=stored.created_at,
        updated_at=stored.updated_at,
    )
