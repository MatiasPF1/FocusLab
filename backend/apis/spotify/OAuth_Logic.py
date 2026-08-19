'''
Spotify OAuth.

Everything to do with *getting and holding* permission to act on a user's
Spotify account, in one place. Two halves live here:

  1. The token lifecycle: reading credentials, storing the token row, and
     refreshing the access token before it expires.
     
  2. The routes that walk the user through the OAuth 2.0 authorization code
     flow, plus the two that report or hand out the resulting token.

Nothing here calls the Spotify Web API to *do* anything
'''

import os
import secrets
import time
from urllib.parse import urlencode
import httpx    # Lets FastAPI send asynchronous HTTP requests to Spotify
from fastapi import Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlmodel import Session
from models.spotify import SpotifyToken
from database import get_session
from apis.spotify.router import router


##########
# Configuration
##########

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
#Where to send the user's browser back to once the Spotify OAuth dance is done.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
#Single-user app: the Spotify token row always lives at this fixed primary key.
SPOTIFY_TOKEN_ROW_ID = 1

#How long a started login may sit unfinished before its state stops being accepted.
LOGIN_STATE_TTL_SECONDS = 600

#A login that is never finished leaves its state behind, so cap how many pile up.
MAX_PENDING_LOGIN_STATES = 16


##########
# Pending logins
##########

'''
The state values we have handed out and are still willing to accept back.

Kept in memory rather than in the database because it is worth nothing after
ten minutes. The only cost is that restarting the backend mid-login forgets the
pending state, and the user has to press connect again.
'''
_pending_login_states: dict[str, float] = {}


####
# Getters or Helper Functions
####

def forget_expired_login_states(now: float) -> None:
    '''
    Drop every pending state that has run out of time.

    An abandoned login - the user closes the Spotify page and never comes back -
    would otherwise leave its state sitting here forever.
    '''
    for expired in [
        state for state, expires_at in _pending_login_states.items() if expires_at <= now
    ]:
        del _pending_login_states[expired]


def remember_login_state(state: str) -> None:
    '''
    1-Forget the states that have already expired
    2-Make room if unfinished logins are piling up
    3-Remember this one, with the moment it stops being valid
    '''
    now = time.time()
    #1-)Expired states can never be claimed again, so drop them on the way past
    forget_expired_login_states(now)
    #2-)Dicts keep insertion order, so the oldest pending login is the one at the front
    while len(_pending_login_states) >= MAX_PENDING_LOGIN_STATES:
        _pending_login_states.pop(next(iter(_pending_login_states)))
    #3-)Valid from now until the TTL runs out
    _pending_login_states[state] = now + LOGIN_STATE_TTL_SECONDS


def claim_login_state(state: str | None) -> bool:
    '''
    1-Refuse a callback that carries no state at all
    2-Refuse one whose state we never handed out, or handed out too long ago
    3-Consume the matching state, so the same callback can never be replayed

    Replaces reading the state back out of a cookie. Same guarantee as before:
    the callback only counts if it belongs to a login this backend started.
    '''
    #1-)Nothing to compare against
    if not state:
        return False
    #2-)An expired state must never match, so clear those out before looking
    forget_expired_login_states(time.time())
    for candidate in list(_pending_login_states):
        #2.1-)compare_digest keeps the comparison time independent of the value
        if secrets.compare_digest(state, candidate):
            #3-)One state, one callback
            del _pending_login_states[candidate]
            return True
    return False


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


##########
# Routed Resources
##########

'''
/spotify/status     --> (Reports whether Spotify has ever been connected)
/spotify/token      --> (Hands the access token to the browser's Web Playback SDK)
/spotify/login      --> (Starts the OAuth flow by redirecting the user to Spotify)
/spotify/callback   --> (Where Spotify sends the user back, and where the code is exchanged)
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


@router.get("/login")
async def spotify_login():
    '''
    1-Getters and Random Val Generation
    2-Permision and Information we want from user
    3-URL Generation and Response Generated to sent to Spotify
    4-Temporarily Store State Value on the Server(To check Spotify Incomings)
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
        "user-read-recently-played",
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
    #4-)Remember this state until Spotify sends the user back carrying it.
    '''
    Held on the server, lets the backend verify that
    Spotify's redirect really came from a login it started, blocking forged
    callbacks.
    '''
    remember_login_state(state)
    return response


# Spotify redirects the user to this endpoint after authorization.
@router.get("/callback")
async def spotify_callback(
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
    1-) Claim the state this backend handed out at /login
    2-) Raise Security Exceptions
    3-) Retrieve Credentials
    4-) HTTP Post code to Spotify
    5-) Conver JSON to Python dicti
    6-) Save tokens
    '''
    #0-)Check whether Spotify returned an authorization error
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/?spotify=error")
    #1-)+2-) Security Exceptions
    '''
    claim_login_state does the matching that compare_digest against the cookie
    used to do, and consumes the state at the same time so one authorization
    can never be replayed twice.
    '''
    if (
        not code                         # Spotify returned an authorization code?
        or not claim_login_state(state)  # Does this state match a login we started?
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
    return RedirectResponse(f"{FRONTEND_URL}/?spotify=connected")
