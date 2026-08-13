'''
Spotify routing resources - GET only.

Every route here only reads: it reports state, searches, or walks the user
through the login redirect. Nothing in this file changes what Spotify is doing.

The commands that DO change playback live in routers/spotify_post.py.
The router and the shared plumbing both files use live in routers/spotify.py.
'''

import secrets
import time
from urllib.parse import urlencode
import httpx    # Lets FastAPI send asynchronous HTTP requests to Spotify
from fastapi import Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlmodel import Session

from routers.database import get_session
from routers.spotify import (
    FRONTEND_URL,
    SPOTIFY_AUTH_URL,
    SPOTIFY_TOKEN_URL,
    get_devices,
    get_spotify_config,
    get_valid_access_token,
    router,
    save_token_record,
    spotify_api_get,
    spotify_api_request,
)


##########
# Routed Resources
##########

'''
/spotify/status     --> (Says whether Spotify is connected right now)
/spotify/player     --> (Reports which song is playing and on which device)
/spotify/token      --> (Hands the browser an access token for its own player)
/spotify/devices    --> (Lists every Spotify app this account can play on)
/spotify/search     --> (Searches Spotify's catalogue for songs to add)
/spotify/login      --> (Starts the Spotify permission flow)
/spotify/callback   --> (Receives Spotify's answer and saves the tokens)
'''


##########
# Routes
##########

@router.get("/status")
async def spotify_status(session: Session = Depends(get_session)):
    '''
    1-Ask for a valid access token, refreshing automatically if needed
    2-Connected only if we ended up with a usable access token
    3-Return the connection status to the caller
    '''
    #1-)This refreshes the token behind the scenes if it's missing/expiring soon
    access_token = await get_valid_access_token(session)
    #2-)Spotify is connected only when we have a usable access token
    connected = bool(access_token)
    #3-)Return the connection status
    return {
        "connected": connected,
        "message": (
            "Spotify is connected"
            if connected
            else "Spotify is not connected"
        ),
    }


@router.get("/player")
async def get_player_state(session: Session = Depends(get_session)):
    '''
    1-Ask Spotify what is playing right now
    2-Report "nothing playing" when Spotify has no session to describe
    3-Return just the bits the player controls need
    '''
    #1-)Returns an empty body when there is no active device at all
    data = await spotify_api_request(session, "GET", "/me/player")

    #2-)No session means nothing to show, and that is not an error
    if not data:
        return {
            "is_playing": False,
            "track_uri": None,
            "track_name": None,
            "artist_name": None,
            "device_name": None,
        }

    #3-)Flatten Spotify's nested shape into what the UI actually renders
    item = data.get("item") or {}
    artists = ", ".join(
        artist["name"]
        for artist in item.get("artists", [])
        if artist.get("name")
    )
    return {
        "is_playing": bool(data.get("is_playing")),
        "track_uri": item.get("uri"),
        "track_name": item.get("name"),
        "artist_name": artists or None,
        "device_name": (data.get("device") or {}).get("name"),
    }


@router.get("/token")
async def get_playback_token(session: Session = Depends(get_session)):
    '''
    1-Refresh the stored token when it is close to expiring
    2-Refuse when Spotify was never connected
    3-Hand the access token to the browser

    The Web Playback SDK runs entirely in the browser, so the browser itself
    genuinely needs the access token. Only our own frontend can read this,
    because the CORS rules in main.py allow no other origin.
    '''
    #1-)get_valid_access_token refreshes behind the scenes when needed
    access_token = await get_valid_access_token(session)
    #2-)Nothing to hand over if the user never connected Spotify
    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Spotify is not connected",
        )
    #3-)The SDK asks for this again by itself once the token expires
    return {"access_token": access_token}


@router.get("/devices")
async def list_spotify_devices(session: Session = Depends(get_session)):
    '''
    1-Ask Spotify which of this account's apps are reachable
    2-Keep only the fields the UI needs to name a device
    '''
    #1-)+2-) Devices without an id cannot be targeted, so they are of no use here
    devices = await get_devices(session)
    return [
        {
            "id": device.get("id"),
            "name": device.get("name"),
            "type": device.get("type"),
            "is_active": bool(device.get("is_active")),
        }
        for device in devices
        if device.get("id")
    ]


@router.get("/search")
async def search_tracks(
    q: str,
    limit: int = 20,
    session: Session = Depends(get_session),
):
    '''
    1-Reject empty searches and out-of-range page sizes
    2-Ask Spotify to search its catalogue for songs
    3-Keep only the few fields the frontend shows
    4-Return the results
    '''
    #1-)An empty query would just make Spotify answer with an error
    query = q.strip()
    if not query:
        raise HTTPException(
            status_code=400,
            detail="Search query cannot be empty",
        )
    #1.1-)Spotify allows at most 50 results per request
    limit = max(1, min(limit, 50))

    #2-)"type=track" keeps albums and podcast episodes out of the results
    data = await spotify_api_get(
        session,
        "/search",
        {"q": query, "type": "track", "limit": limit},
    )

    #3-)Trim each hit down to exactly what a queue track needs
    results = []
    for track in (data.get("tracks") or {}).get("items", []):
        #3.1-)Spotify occasionally returns null entries, skip them
        if not track or not track.get("uri"):
            continue
        #3.2-)A song can have several artists, join them into one readable line
        artists = ", ".join(
            artist["name"]
            for artist in track.get("artists", [])
            if artist.get("name")
        )
        images = (track.get("album") or {}).get("images") or []
        results.append({
            "track_uri": track["uri"],
            "track_name": track.get("name") or "Untitled track",
            "artist_name": artists or "Unknown artist",
            #3.3-)Spotify lists images largest first, so the last one is the thumbnail
            "image_url": images[-1].get("url") if images else None,
        })
    #4-)Return the trimmed results
    return results


@router.get("/login")
async def spotify_login():
    '''
    1-Getters and Random Val Generation
    2-Permision and Information we want from user
    3-URL Generation and Response Generated to sent to Spotify
    4-Temporarily Store State Value in Cookies(To check Spotify Incomings)
    '''
    #1-)We need the client ID and redirect URI to build the Spotify URL.
    client_id, _, redirect_uri = get_spotify_config()
    #1.1-)Generates a secure random value for this login attempt.
    state = secrets.token_urlsafe(32)
   #2-)Permissions FocusLab is requesting from the user
    scopes = [
        "playlist-read-private",
        "playlist-read-collaborative",
        "user-read-private",
        "user-read-email",
        "user-read-playback-state",
        "user-modify-playback-state",
        "streaming",
    ]
    #2.1-)Information Spotify needs for the authorization request
    parameters = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": " ".join(scopes),
        "state": state,
    }
    #3-) Create an URL of the type : https://accounts.spotify.com/authorize?client_id=...&scope=...
    authorization_url = (f"{SPOTIFY_AUTH_URL}?{urlencode(parameters)}")
    #3.1-)Sends the user's browser to Spotify
    response = RedirectResponse(authorization_url)
    #4-)Temporarily stores the state value in a browser cookie.
    '''
    A short-lived, tamper-resistant cookie that lets
     backend verify Spotify's redirect really came
    from a login it started, blocking forged callbacks.
    '''
    response.set_cookie(
        key="spotify_oauth_state",
        value=state,           # States we want to check
        httponly=True,         # Prevents JavaScript from reading this cookie
        samesite="lax",        # Helps protect the cookie from cross-site attacks
        secure=False,          # Change this to True when using HTTPS in production.
        max_age=600,           # Cookie expires after 10 minutes
    )
    return response



# Spotify redirects the user to this endpoint after authorization.
@router.get("/callback")
async def spotify_callback(request: Request,
    # Temporary authorization code returned by Spotify
    code: str | None = None,
    # Security state value returned by Spotify
    state: str | None = None,
    # Contains an error if the user rejects authorization
    error: str | None = None,
    session: Session = Depends(get_session),
):
    '''
    0-) Error Callback
    1-) Read State from User Cookies
    2-) Raise Security Exceptions
    3-) Retrieve Credentials
    4-) HTTP Post code to Spotify
    5-) Conver JSON to Python dicti
    6-) Save tokens
    7-) Delete cookie
    '''
    #0-)Check whether Spotify returned an authorization error
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/?spotify=error")
    #1-)Read the original state value from the user's cookie
    saved_state = request.cookies.get("spotify_oauth_state")
    #2-) Security Exceptions
    if (
        not code                                                  # Spotify returned an authorization code?
        or not state                                              # Spotify returned a state value?
        or not saved_state                                        # We previously saved a state value?
        or not secrets.compare_digest(state, saved_state)         # Do Both state values match securely
    ):
        return RedirectResponse(f"{FRONTEND_URL}/?spotify=error")
    #3-) Get the credentials needed for the token request
    client_id, client_secret, redirect_uri = get_spotify_config()
    #4-)HTTP Post Autorizathion code to Spotify
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            SPOTIFY_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            },
            # Securely sends the Spotify client ID and secret
            auth=httpx.BasicAuth(
                client_id,
                client_secret,
            ),
        )
    #4.1-)Spotify normally returns status code 200 when successful
    if token_response.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/?spotify=error")
    #5-)  Convert Spotify's JSON response into a Python dictionary
    token_data = token_response.json()
    #5.1-) Save the access token, refresh token, and expiration time to the database
    save_token_record(
        session,
        access_token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        expires_at=time.time() + token_data["expires_in"],
    )
    #6-) Send the user's browser back to the frontend now that Spotify is connected
    response = RedirectResponse(f"{FRONTEND_URL}/?spotify=connected")
    #7-) delete cookie, no longer needed after authorization
    response.delete_cookie("spotify_oauth_state")
    return response
