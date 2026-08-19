'''
Queue routing resources - DELETE.

Removing a queue along with its songs, or removing one song out of the middle
of a queue and closing the gap it leaves.

The other verbs live beside this file in apis/queues/routes/.
The router and the shared plumbing they all use live in apis/queues/core.py.
'''

from fastapi import Depends, HTTPException
from sqlmodel import Session, select

from models_Queues import QueueTrack
from database import get_session
from apis.queues.core import get_queue_or_404, router


##########
# Routed Resources
##########

'''
/queues/{queue_id}                    --> (Deletes a queue along with its songs)
/queues/{queue_id}/tracks/{track_id}  --> (Removes one song and closes the gap it leaves)
'''


##########
# Routes
##########

@router.delete("/{queue_id}", status_code=204)
def delete_queue(
    queue_id: int,
    session: Session = Depends(get_session),
):
    '''
    1-Find the queue (404 if it doesn't exist)
    2-Delete its tracks first so no orphan rows are left behind
    3-Delete the queue itself
    '''
    #1-)Make sure the queue exists before deleting anything
    queue = get_queue_or_404(session, queue_id)
    #2-)No database-level cascade is configured, so remove the child tracks by hand
    tracks = session.exec(
        select(QueueTrack).where(QueueTrack.queue_id == queue_id)
    ).all()
    for track in tracks:
        session.delete(track)
    #3-)Now the queue can go
    session.delete(queue)
    session.commit()
    #204 No Content means success with nothing to return


@router.delete("/{queue_id}/tracks/{track_id}", status_code=204)
def delete_queue_track(
    queue_id: int,
    track_id: int,
    session: Session = Depends(get_session),
):
    '''
    1-Find the queue (404 if it doesn't exist)
    2-Find the track, making sure it really belongs to that queue
    3-Delete it and close the gap it left in the ordering
    '''
    #1-)Make sure the queue exists
    get_queue_or_404(session, queue_id)
    #2-)Checking queue_id too stops one queue from deleting another queue's track
    track = session.get(QueueTrack, track_id)
    if not track or track.queue_id != queue_id:
        raise HTTPException(
            status_code=404,
            detail="Track not found in this queue",
        )
    removed_position = track.position
    session.delete(track)
    #3-)Shift the songs after it up by one so positions stay 1,2,3... with no holes
    later_tracks = session.exec(
        select(QueueTrack)
        .where(QueueTrack.queue_id == queue_id)
        .where(QueueTrack.position > removed_position)
    ).all()
    for later_track in later_tracks:
        later_track.position -= 1
        session.add(later_track)
    session.commit()
    #204 No Content means success with nothing to return
