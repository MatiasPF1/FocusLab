'''
Queue routing resources - GET only.

Every route here only reads saved queues. Nothing in this file creates,
changes or deletes anything.

The routes that DO change queues live in routers/queues_post.py.
The router and the shared plumbing both files use live in routers/queues.py.
'''

from fastapi import Depends
from sqlmodel import Session, select

from models import Queue, QueueRead, QueueReadWithTracks
from routers.database import get_session
from routers.queues import get_queue_or_404, router


##########
# Routed Resources
##########

'''
/queues              --> (Lists every saved queue, newest first)
/queues/{queue_id}   --> (Returns one queue together with all of its songs)
'''


##########
# Routes
##########

@router.get("", response_model=list[QueueRead])
def list_queues(session: Session = Depends(get_session)):
    '''
    1-Ask for every queue, newest first
    2-Return them as a list
    '''
    #1-)Newest first so the queue a user just made shows up at the top
    queues = session.exec(
        select(Queue).order_by(Queue.created_at.desc())
    ).all()
    #2-)Return the list
    return queues


@router.get("/{queue_id}", response_model=QueueReadWithTracks)
def get_queue(
    queue_id: int,
    session: Session = Depends(get_session),
):
    '''
    1-Find the queue (404 if it doesn't exist)
    2-Return it together with all of its tracks
    '''
    #1-)+2-) The response model pulls in the related tracks automatically
    return get_queue_or_404(session, queue_id)
