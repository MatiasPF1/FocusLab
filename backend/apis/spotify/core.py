'''
Spotify Web API plumbing.

Everything to do with *using* an authorization we already hold: calling the
Spotify Web API, translating its errors into ones our frontend understands, and
choosing which device a playback command goes to.

Getting that authorization in the first place - the login flow and the token
lifecycle - lives in apis/spotify/OAuth_Logic.py. This file depends on it for
get_valid_access_token() and never the other way round.

No routes are declared in this file, so nothing here is reachable from a URL on
its own. They are declared in apis/spotify/routes/, one file per HTTP method.
'''

import httpx    # Lets FastAPI send asynchronous HTTP requests to Spotify
from fastapi import HTTPException
from sqlmodel import Session

from apis.spotify.OAuth_Logic import get_valid_access_token


##########
# Configuration
##########

SPOTIFY_API_BASE = "https://api.spotify.com/v1"


####
# Getters or Helper Functions
####

def read_spotify_error(response) -> str | None:
    '''
    Pull Spotify's own explanation out of an error body, when it sent one.
    '''
    try:
        return (response.json().get("error") or {}).get("message")
    except Exception:
        return None


async def spotify_api_request(
    session: Session,
    method: str,
    url: str,
    params: dict | None = None,
    json: dict | None = None,
):
    '''
    1-Get a valid access token (refreshing it first if needed)
    2-Call the Spotify Web API with that token
    3-Turn Spotify errors into clear HTTP errors for our own frontend
    4-Return the decoded JSON, or None when Spotify replies with an empty body
    '''
    #1-)Every Spotify API call needs a non-expired access token
    access_token = await get_valid_access_token(session)
    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Spotify is not connected",
        )
    #2-)Paging links from Spotify are absolute URLs, everything else is a short path like "/me/player"
    full_url = url if url.startswith("http") else f"{SPOTIFY_API_BASE}{url}"
    async with httpx.AsyncClient() as client:
        response = await client.request(
            method,
            full_url,
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
            json=json,
        )
    #3-)Tell the caller apart: our token went bad vs Spotify itself had a problem
    if response.status_code == 401:
        raise HTTPException(
            status_code=401,
            detail="Spotify authorization expired, please reconnect",
        )
    '''
    403 covers very different situations, so pass Spotify's own wording through:
    reading playlist contents is blocked for this app (Extended Quota Mode), while
    playback control is blocked for accounts without Premium.
    '''
    if response.status_code == 403:
        spotify_message = read_spotify_error(response) or ""
        '''
        The one exception is "Restriction violated", which only means the command
        made no sense for the current state, such as pausing something that is
        already paused. Our state comes from a poll, so it can lag a few seconds
        behind Spotify and produce exactly that.
        '''
        if "Restriction violated" in spotify_message:
            raise HTTPException(
                status_code=409,
                detail="Spotify is already in that state.",
            )
        raise HTTPException(
            status_code=403,
            detail=spotify_message or "Spotify refused this request",
        )
    '''
    3.1-)Playback commands already pick their target device up front, so a 404 here
    means that device disappeared between choosing it and sending the command.
    '''
    if response.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail=(
                "Spotify lost the device this was sent to. Open the Spotify app "
                "again, then try again."
            ),
        )
    if response.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="Spotify rate limit reached, please try again shortly",
        )
    #3.2-)Anything else left over is a genuine failure on Spotify's side
    if response.status_code not in (200, 201, 202, 204):
        raise HTTPException(
            status_code=502,
            detail=read_spotify_error(response) or "Spotify API request failed",
        )
    '''
    4-)Not every success carries JSON. GET /me/player answers 204 when nothing is
    playing, and the playback commands answer 200 with a bare command id that is
    not JSON at all. Both mean "worked, nothing to report", so only decode a body
    Spotify actually labelled as JSON.
    '''
    if not response.content:
        return None
    if "json" not in response.headers.get("content-type", ""):
        return None
    #4.1-)Hand back the decoded JSON
    return response.json()


async def spotify_api_get(
    session: Session,
    url: str,
    params: dict | None = None,
):
    '''
    Convenience wrapper for the common case: a plain GET.
    '''
    return await spotify_api_request(session, "GET", url, params=params)


async def get_devices(session: Session) -> list[dict]:
    '''
    List every Spotify app this account is currently signed in to.
    '''
    data = await spotify_api_get(session, "/me/player/devices")
    return (data or {}).get("devices") or []


async def resolve_device_id(session: Session) -> str:
    '''
    1-Ask Spotify which devices it can reach
    2-Stop with an actionable message when there is nowhere to play
    3-Prefer the device already playing, otherwise take the first usable one

    A Spotify app that is merely open counts as visible but NOT active, and
    "active" is what Spotify falls back to when a command names no device. So
    naming the device explicitly is what makes a freshly opened app play.
    '''
    #1-)Everything Spotify can currently see for this account
    devices = await get_devices(session)

    '''
    2-)Nothing at all is reachable. Usually that just means the browser's own
    player has not finished connecting yet, so mention it before suggesting the
    Spotify app, which is the thing this whole setup exists to avoid needing.
    '''
    if not devices:
        raise HTTPException(
            status_code=404,
            detail=(
                "No Spotify device found yet. Give the FocusLab player a moment "
                "to start, or open the Spotify app."
            ),
        )

    #3-)Whatever is already playing stays the target, so we never steal the sound
    for device in devices:
        if device.get("is_active") and device.get("id"):
            return device["id"]

    #3.1-)Otherwise wake up the first device that accepts remote control
    for device in devices:
        if device.get("id") and not device.get("is_restricted"):
            return device["id"]

    #3.2-)Every device refused remote control, which playing locally once fixes
    raise HTTPException(
        status_code=403,
        detail=(
            "Spotify sees your device but will not let this app control it. "
            "Play a song directly in Spotify once, then try again."
        ),
    )


async def player_command(
    session: Session,
    method: str,
    url: str,
    json: dict | None = None,
    device_id: str | None = None,
):
    '''
    Send a playback command aimed at a specific device.

    Every playback route goes through here so that an idle Spotify app is
    targeted by id instead of relying on there being an active device.

    The caller passes device_id when it already knows where the sound belongs,
    which is how the browser's own Web Playback SDK player gets chosen over any
    other Spotify app that happens to be signed in.
    '''
    #1-)Use the device we were given, or pick one ourselves
    target_device_id = device_id or await resolve_device_id(session)
    try:
        return await spotify_api_request(
            session,
            method,
            url,
            params={"device_id": target_device_id},
            json=json,
        )
    except HTTPException as command_error:
        '''
        2-)A 404 means Spotify does not recognise that device. The browser player
        reconnects under a brand new id every time the page reloads or its
        connection drops, so a caller can easily still be holding the old one.
        Look the current device up and try once more before giving up.
        '''
        #2.1-)Only a stale id handed to us is worth retrying
        if command_error.status_code != 404 or device_id is None:
            raise
        #2.2-)If Spotify still points at the same device, retrying changes nothing
        fresh_device_id = await resolve_device_id(session)
        if fresh_device_id == target_device_id:
            raise
        #3-)Send the same command again, this time at the device that really exists
        return await spotify_api_request(
            session,
            method,
            url,
            params={"device_id": fresh_device_id},
            json=json,
        )
