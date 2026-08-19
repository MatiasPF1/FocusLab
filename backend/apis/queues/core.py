'''
Queues.

The base of everything queue related. Two things live here:

  1. The router itself, which every file in routes/ attaches its routes to.
  2. The plumbing they share.

No routes are declared in this file, so nothing here is reachable from a URL on
its own. They are declared in apis/queues/routes/, one file per HTTP method,
all onto the router below.
'''

from fastapi import APIRouter, HTTPException
from sqlmodel import Session

from models_Queues import Queue


##########
# Router
##########

'''
Declared once here and imported by both route files, so every queue route shares
one prefix and one tag no matter which file it is written in.
'''
router = APIRouter(
    prefix="/queues",    #localhost....8000/queues + routes designed
    tags=["Queues"],     #Tag Queues
)


####
# Getters or Helper Functions
####

def get_queue_or_404(session: Session, queue_id: int) -> Queue:
    '''
    1-Look the queue up by its primary key
    2-Stop the request with a clear 404 if it doesn't exist
    3-Return the queue to the caller
    '''
    #1-)Fetch the queue row
    queue = session.get(Queue, queue_id)
    #2-)Every route that uses this needs a real queue, so fail loudly when it's missing
    if not queue:
        raise HTTPException(
            status_code=404,
            detail="Queue not found",
        )
    #3-)Hand the queue back to whichever route called this
    return queue
