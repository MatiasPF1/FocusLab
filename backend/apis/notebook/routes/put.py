'''
Notebook routing resources - PUT.

Storing the LaTeX a page was converted into, so it is still there when the page
is opened again tomorrow.

PUT rather than POST because there is one conversion per page and the client
names which page it is: sending the same page twice replaces what is stored
instead of piling up rows.

The other verbs live beside this file in apis/notebook/routes/.
The router and the shared plumbing they all use live in apis/notebook/core.py.
'''

import base64
from datetime import datetime

from fastapi import Depends, HTTPException
from sqlmodel import Session

from models.notebook import NotebookLatex, NotebookLatexRead, NotebookLatexSave
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
/notebook/{entry_id}/latex/{page_index}   --> (Stores the LaTeX for one page)
'''


##########
# Routes
##########

@router.put("/{entry_id}/latex/{page_index}", response_model=NotebookLatexRead)
def save_entry_latex(
    entry_id: int,
    page_index: int,
    payload: NotebookLatexSave,
    session: Session = Depends(get_session),
):
    '''
    1-Find the entry (404 if it doesn't exist)
    2-Decode the PDF, if one came with it
    3-Replace what is stored for that page, or store the first one
    4-Return what is now stored
    '''
    #1-)No storing conversions against an entry that is not there
    get_entry_or_404(session, entry_id)

    #2-)It travelled as base64 inside JSON; the column holds bytes
    pdf = None
    if payload.pdf:
        try:
            pdf = base64.b64decode(payload.pdf, validate=True)
        except Exception:
            raise HTTPException(
                status_code=422,
                detail="The PDF was not valid base64",
            )

    #3-)One row per page, so a second conversion overwrites the first. created_at
    #   deliberately keeps the original: it says when this page was first
    #   converted, updated_at says when it was last redone.
    stored = get_stored_latex(session, entry_id, page_index)
    if stored:
        stored.source = payload.source
        stored.pdf = pdf
        stored.page_hash = payload.page_hash
        stored.updated_at = datetime.utcnow()
    else:
        stored = NotebookLatex(
            entry_id=entry_id,
            page_index=page_index,
            source=payload.source,
            pdf=pdf,
            page_hash=payload.page_hash,
        )

    session.add(stored)
    session.commit()
    session.refresh(stored)
    #4-)
    return read_stored_latex(stored)
