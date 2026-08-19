'''
Spotify routing resources - PUT.

Pause and resume are PUT because they describe a state to be in, so asking
twice is harmless.

The other verbs live beside this file in apis/spotify/routes/.
The router lives in apis/spotify/router.py, the Web API plumbing in
apis/spotify/core.py, and the login flow in apis/spotify/OAuth_Logic.py.
'''

from fastapi import Depends
from sqlmodel import Session

from database import get_session
from apis.spotify.router import router
from apis.spotify.core import player_command


##########
# Routed Resources
##########

'''
/spotify/pause    --> (Stops playback, keeping the place in the queue)
/spotify/resume   --> (Carries on from wherever playback was paused)
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
