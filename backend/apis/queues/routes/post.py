'''
Queue routing resources - POST.

Every route here creates something or sets something running: a new queue, a new
song at the end of one, or playback of a whole queue on Spotify.

The other verbs live beside this file in apis/queues/routes/.
The router and the shared plumbing they all use live in apis/queues/core.py.
'''

from fastapi import Depends, HTTPException
from sqlmodel import Session, select

from models_Queues import (
    Queue,
    QueueCreate,
    QueueRead,
    QueueTrack,
    QueueTrackCreate,
    QueueTrackRead,
)
from database import get_session
from apis.queues.core import get_queue_or_404, router
from apis.spotify.core import player_command


##########
# Routed Resources
##########

'''
/queues                     --> (Creates a new empty queue)
/queues/{queue_id}/play     --> (Plays the whole queue on Spotify from a chosen song)
/queues/{queue_id}/tracks   --> (Appends a song to the end of the queue)
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
