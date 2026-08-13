'''
Spotify routing resources - the ones that change something.

Every route here sends a command that alters playback, so none of them are GET:
pause and resume are PUT because asking twice is harmless, while next and
previous are POST because each call moves the queue along.

The read-only routes live in routers/spotify_get.py.
The router and the shared plumbing both files use live in routers/spotify.py.
'''

from fastapi import Depends
from sqlmodel import Session

from routers.database import get_session
from routers.spotify import player_command, router


##########
# Routed Resources
##########

'''
/spotify/pause      --> (Stops playback, keeping the place in the queue)
/spotify/resume     --> (Carries on from wherever playback was paused)
/spotify/next       --> (Jumps forward to the next song)
/spotify/previous   --> (Jumps back to the previous song)
'''


##########
# Routes
##########

'''
Every playback route takes an optional device_id. The frontend passes the id of
its own in-browser player, so the sound comes out of FocusLab itself. Leaving it
out falls back to picking whichever Spotify app is reachable.
'''


@router.put("/pause", status_code=204)
async def pause_playback(
    device_id: str | None = None,
    session: Session = Depends(get_session),
):
    '''
    Stop playback, keeping the queue exactly where it is.
    '''
    await player_command(session, "PUT", "/me/player/pause", device_id=device_id)


@router.put("/resume", status_code=204)
async def resume_playback(
    device_id: str | None = None,
    session: Session = Depends(get_session),
):
    '''
    Carry on from wherever playback was paused.
    A play call with no song list means "resume", it does not restart the queue.
    '''
    await player_command(session, "PUT", "/me/player/play", device_id=device_id)


@router.post("/next", status_code=204)
async def skip_to_next(
    device_id: str | None = None,
    session: Session = Depends(get_session),
):
    '''
    Jump to the next song. Nothing is removed from the saved queue.
    '''
    await player_command(session, "POST", "/me/player/next", device_id=device_id)


@router.post("/previous", status_code=204)
async def skip_to_previous(
    device_id: str | None = None,
    session: Session = Depends(get_session),
):
    '''
    Jump back to the previous song. Nothing is removed from the saved queue.
    '''
    await player_command(
        session, "POST", "/me/player/previous", device_id=device_id
    )
