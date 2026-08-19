'''
Spotify routing resources - POST.

Next and previous are POST because each call moves the queue along, so calling
twice is not the same as calling once.

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
