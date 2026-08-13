'''
Spotify.

The base of everything Spotify. Two things live here:

  1. The router itself, which both route files attach their routes to.
  2. The plumbing they share: reading credentials, keeping tokens fresh,
     calling the Spotify Web API and choosing which device a command goes to.

No routes are declared in this file, so nothing here is reachable from a URL on
its own. They are declared in routers/spotify_get.py (reads) and
routers/spotify_post.py (playback commands), both onto the router below.
'''

import os
import time
import httpx    # Lets FastAPI send asynchronous HTTP requests to Spotify
from fastapi import APIRouter, HTTPException
from sqlmodel import Session

from models import SpotifyToken


##########
# Router
##########

'''
Declared once here and imported by both route files, so every Spotify route
shares one prefix and one tag no matter which file it is written in.
'''
router = APIRouter(
    prefix="/spotify",   #localhost....8000/spotify + routes desgined
    tags=["Spotify"],    #Tag Spoti1fy
)


##########
# Configuration
##########

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"
#Where to send the user's browser back to once the Spotify OAuth dance is done.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

#Single-user app: the Spotify token row always lives at this fixed primary key.
SPOTIFY_TOKEN_ROW_ID = 1


####
# Getters or Helper Functions
####

def get_spotify_config():
    '''
    1-Read Spotify credentials from the environment
    2-Stop the request if any credential is missing
    3-Return the credentials to the caller
    '''
    #1-)Reads the Spotify credentials from the backend environment
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    redirect_uri = os.getenv("SPOTIFY_REDIRECT_URI")

    #2-)Stop the request if any required environment variable is missing
    if not client_id or not client_secret or not redirect_uri:
        raise HTTPException(
            status_code=500,
            detail="Spotify environment variables are missing",
        )
    #3-)Hand the credentials back to whichever route called this
    return client_id, client_secret, redirect_uri


def get_token_record(session: Session) -> SpotifyToken | None:
    '''
    Read the single stored Spotify token row, if any exists.
    '''
    return session.get(SpotifyToken, SPOTIFY_TOKEN_ROW_ID)


def save_token_record(
    session: Session,
    access_token: str,
    refresh_token: str | None,
    expires_at: float,
) -> SpotifyToken:
    '''
    1-Load the existing token row, or start a new one at the fixed id
    2-Update its fields
    3-Persist it to the database
    4-Return the saved row
    '''
    #1-)Reuse the existing row if we have one, otherwise create it
    token = session.get(SpotifyToken, SPOTIFY_TOKEN_ROW_ID) or SpotifyToken(
        id=SPOTIFY_TOKEN_ROW_ID
    )
    #2-)Update the token fields
    token.access_token = access_token
    #2.1-)Spotify doesn't always send a fresh refresh token, keep the old one when it doesn't
    if refresh_token:
        token.refresh_token = refresh_token
    token.expires_at = expires_at
    #3-)Persist the row
    session.add(token)
    session.commit()
    session.refresh(token)
    #4-)Hand the saved row back to the caller
    return token


async def refresh_access_token(session: Session):
    '''
    1-Stop if we have no refresh token to work with
    2-Ask Spotify for a new access token using the refresh token
    3-Save the new access token (and refresh token, if Spotify sent one)
    4-Return the fresh access token
    '''
    #1-)Without a refresh token we cannot get a new access token
    token = get_token_record(session)
    if not token or not token.refresh_token:
        return None
    #1.1-)Credentials required to authenticate the refresh request
    client_id, client_secret, _ = get_spotify_config()
    #2-)Ask Spotify to exchange the refresh token for a new access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            SPOTIFY_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": token.refresh_token,
            },
            auth=httpx.BasicAuth(client_id, client_secret),
        )
    #2.1-)If Spotify rejects the refresh token, drop the stale token row
    if token_response.status_code != 200:
        session.delete(token)
        session.commit()
        return None
    token_data = token_response.json()
    #3-)Save the new access token (and refresh token, if Spotify sent a new one)
    updated_token = save_token_record(
        session,
        access_token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        expires_at=time.time() + token_data["expires_in"],
    )
    #4-)Hand the fresh access token back to the caller
    return updated_token.access_token



async def get_valid_access_token(session: Session):
    '''
    1-Return None if we have never connected to Spotify
    2-Refresh automatically when the token is missing/expiring soon
    3-Return the current (now guaranteed valid) access token
    '''
    #1-)No token row ever stored means we are not connected
    token = get_token_record(session)
    if not token:
        return None
    #2-)Refresh a bit before actual expiry to avoid using a stale token mid-request
    REFRESH_BUFFER_SECONDS = 60
    if time.time() >= token.expires_at - REFRESH_BUFFER_SECONDS:
        return await refresh_access_token(session)
    #3-)Existing access token is still valid
    return token.access_token


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
