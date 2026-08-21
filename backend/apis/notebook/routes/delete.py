'''
Notebook routing resources - DELETE.

Removing an entry, and with it every conversion stored against its pages -
those rows are about a page that is about to stop existing, and SQLite does not
enforce the foreign key that would clear them by itself.

The other verbs live beside this file in apis/notebook/routes/.
The router and the shared plumbing they all use live in apis/notebook/core.py.
'''

from fastapi import Depends
from sqlmodel import Session, select

from models.notebook import NotebookLatex
from database import get_session
from apis.notebook.core import get_entry_or_404, router


##########
# Routed Resources
##########

'''
/notebook/{entry_id}   --> (Deletes an entry)
'''


##########
# Routes
##########

@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    entry_id: int,
    session: Session = Depends(get_session),
):
    '''
    1-Find the entry (404 if it doesn't exist)
    2-Delete every conversion stored for its pages
    3-Delete the entry itself
    '''
    #1-)Make sure the entry exists before deleting it
    entry = get_entry_or_404(session, entry_id)
    #2-)Otherwise these outlive the entry and the next one to take that id
    #   would inherit somebody else's LaTeX
    stored = session.exec(
        select(NotebookLatex).where(NotebookLatex.entry_id == entry_id)
    ).all()
    for conversion in stored:
        session.delete(conversion)
    #3-)
    session.delete(entry)
    session.commit()
    #204 No Content means success with nothing to return
