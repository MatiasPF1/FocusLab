'''
Queue routing resources - PATCH.

Renaming is the only part of a queue the client is allowed to edit in place,
so this file holds a single route.

The other verbs live beside this file in apis/queues/routes/.
The router and the shared plumbing they all use live in apis/queues/core.py.
'''

from fastapi import Depends, HTTPException
from sqlmodel import Session

from models_Queues import QueueRead, QueueUpdate
from database import get_session
from apis.queues.core import get_queue_or_404, router


##########
# Routed Resources
##########

'''
/queues/{queue_id}   --> (Renames a queue)
'''


##########
# Routes
##########

@router.patch("/{queue_id}", response_model=QueueRead)
def update_queue(
    queue_id: int,
    payload: QueueUpdate,
    session: Session = Depends(get_session),
):
    '''
    1-Find the queue (404 if it doesn't exist)
    2-Reject empty names
    3-Apply the new name and save
    4-Return the updated queue
    '''
    #1-)Make sure the queue exists before changing anything
    queue = get_queue_or_404(session, queue_id)
    #2-)Same rule as creating: a blank name is not allowed
    name = payload.name.strip()
    if not name:
        raise HTTPException(
            status_code=400,
            detail="Queue name cannot be empty",
        )
    #3-)Rename and persist
    queue.name = name
    session.add(queue)
    session.commit()
    session.refresh(queue)
    #4-)Return the updated queue
    return queue
