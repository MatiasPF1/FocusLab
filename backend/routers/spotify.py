import os
import secrets
import time
from urllib.parse import urlencode
import httpx    # Lets FastAPI send asynchronous HTTP requests to Spotify
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse


SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
router = APIRouter(
    prefix="/spotify",   #localhost....8000/spotify + routes desgined
    tags=["Spotify"],    #Tag Spotify 
)
spotify_tokens = {}      #This will later be replaced with database storage for each user.


####
# Getters or Helper FUnctions
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




##########
# Routes
##########

@router.get("/status")
async def spotify_status():
    '''
    1-Read the saved access token and its expiration time
    2-Check whether the token exists and hasn't expired yet
    3-Return the connection status to the caller
    '''

    #1-)Get the saved access token
    access_token = spotify_tokens.get("access_token")
    #1.1-)Get its expiration time
    expires_at = spotify_tokens.get("expires_at", 0)

    #2-)Spotify is connected only when an access token exists AND it hasn't expired yet
    connected = bool(
        access_token
        and expires_at > time.time()
    )

    #3-)Return the connection status
    return {
        "connected": connected,
        "message": (
            "Spotify is connected"
            if connected
            else "Spotify is not connected"
        ),
    }

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
        raise HTTPException(
            status_code=400,
            detail=f"Spotify authorization failed: {error}",
        )
    
    
    #1-)Read the original state value from the user's cookie
    saved_state = request.cookies.get("spotify_oauth_state")
    
    #2-) Security Exceptions
    if (
        not code                                                  # Spotify returned an authorization code?
        or not state                                              # Spotify returned a state value?
        or not saved_state                                        # We previously saved a state value?
        or not secrets.compare_digest(state, saved_state)         # Do Both state values match securely
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid Spotify authorization state",
        )
        
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
        raise HTTPException(
            status_code=400,
            detail="Spotify token exchange failed",
        )
    
    #5-)  Convert Spotify's JSON response into a Python dictionary
    token_data = token_response.json()

    #5.1-) Save the temporary access token
    spotify_tokens["access_token"] = token_data["access_token"]

    #5.2-) Save the refresh token used to request future access tokens
    spotify_tokens["refresh_token"] = token_data.get("refresh_token")
    
    
    #5.3-) Calculate the exact time when the access token will expire
    spotify_tokens["expires_at"] = (
        time.time() + token_data["expires_in"]
    )
    
    #6-) Create the successful JSON response
    response = JSONResponse(
        content={
            "connected": True,
            "message": "Spotify connected successfully",
        }
    )

    #7-) delete cookie, no longer needed after authorization
    response.delete_cookie("spotify_oauth_state")

    return response






        




    
    









