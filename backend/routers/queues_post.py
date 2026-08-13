'''
Queue routing resources - the ones that change something.

Every route here writes: creating, renaming, deleting, or handing a queue to
Spotify to play. None of them are GET.

The read-only routes live in routers/queues_get.py.
The router and the shared plumbing both files use live in routers/queues.py.
'''

from fastapi import Depends, HTTPException
from sqlmodel import Session, select

from models import (
    Queue,
    QueueCreate,
    QueueRead,
    QueueTrack,
    QueueTrackCreate,
    QueueTrackRead,
    QueueUpdate,
)
from routers.database import get_session
from routers.queues import get_queue_or_404, router
from routers.spotify import player_command


##########
# Routed Resources
##########

'''
/queues                               --> (Creates a new empty queue)
/queues/{queue_id}                    --> (Renames a queue, or deletes it along with its songs)
/queues/{queue_id}/play               --> (Plays the whole queue on Spotify from a chosen song)
/queues/{queue_id}/tracks             --> (Appends a song to the end of the queue)
/queues/{queue_id}/tracks/{track_id}  --> (Removes one song and closes the gap it leaves)
'''


##########
# Routes
##########

@router.post("", response_model=QueueRead, status_code=201)
def create_queue(
    payload: QueueCreate,
    session: Session = Depends(get_session),
):
    '''
    1-Reject empty names
    2-Build the new queue row
    3-Save it to the database
    4-Return the created queue (now with its id and created_at filled in)
    '''
    #1-)A queue with a blank name would be useless in the UI
    name = payload.name.strip()
    if not name:
        raise HTTPException(
            status_code=400,
            detail="Queue name cannot be empty",
        )
    #2-)Only the name comes from the client, id and created_at are set by the database/model
    queue = Queue(name=name)
    #3-)Persist the new row
    session.add(queue)
    session.commit()
    session.refresh(queue)
    #4-)Return the saved queue
    return queue


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


@router.post("/{queue_id}/play", status_code=204)
async def play_queue(
    queue_id: int,
    position: int = 1,
    device_id: str | None = None,
    session: Session = Depends(get_session),
):
    '''
    1-Find the queue (404 if it doesn't exist)
    2-Refuse to play a queue with no songs in it
    3-Check the starting song actually exists
    4-Hand the whole queue to Spotify and start at the chosen song

    device_id names where the sound should come out, which the frontend sets to
    its own in-browser player. Left out, Spotify plays on whatever app is open.

    Spotify keeps its own copy of this song list while it plays, so reaching the
    end of a song moves to the next one without ever touching our saved queue.
    Songs only leave a queue when the user deletes them.
    '''
    #1-)Make sure the queue exists
    get_queue_or_404(session, queue_id)

    #2-)Read the songs in playing order
    tracks = session.exec(
        select(QueueTrack)
        .where(QueueTrack.queue_id == queue_id)
        .order_by(QueueTrack.position)
    ).all()
    if not tracks:
        raise HTTPException(
            status_code=400,
            detail="This queue has no songs to play",
        )

    #3-)Positions are 1-based for us, so guard against a bad starting point
    if position < 1 or position > len(tracks):
        raise HTTPException(
            status_code=400,
            detail="That song is not in this queue",
        )

    #4-)Spotify counts from 0, we count from 1
    await player_command(
        session,
        "PUT",
        "/me/player/play",
        json={
            "uris": [track.track_uri for track in tracks],
            "offset": {"position": position - 1},
        },
        device_id=device_id,
    )
    #204 No Content means the command was accepted


@router.post("/{queue_id}/tracks", response_model=QueueTrackRead, status_code=201)
def add_queue_track(
    queue_id: int,
    payload: QueueTrackCreate,
    session: Session = Depends(get_session),
):
    '''
    1-Find the queue (404 if it doesn't exist)
    2-Work out where the new song goes: straight onto the end
    3-Save the song
    4-Return it
    '''
    #1-)Make sure the queue exists before adding anything to it
    get_queue_or_404(session, queue_id)
    #2-)Highest position currently in the queue, or 0 when the queue is still empty
    last_position = session.exec(
        select(QueueTrack.position)
        .where(QueueTrack.queue_id == queue_id)
        .order_by(QueueTrack.position.desc())
    ).first() or 0
    #3-)Append the song one slot after the current last one
    track = QueueTrack(
        queue_id=queue_id,
        track_uri=payload.track_uri,
        track_name=payload.track_name,
        artist_name=payload.artist_name,
        position=last_position + 1,
    )
    session.add(track)
    session.commit()
    session.refresh(track)
    #4-)Return the saved song
    return track


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
