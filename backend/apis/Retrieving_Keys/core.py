'''
Retrieving Keys.

The base of everything credential related. Two things live here:

  1. The router itself, which every file in routes/ attaches its routes to.
  2. The plumbing they share: reading and writing the single credentials row.

No routes are declared in this file, so nothing here is reachable from a URL on
its own. They are declared in apis/Retrieving_Keys/routes/, one file per HTTP
method, all onto the router below.

FocusLab is being built as a DESKTOP app (one install per user, backend on
localhost), not a hosted web app, so keys the user pastes here never leave
their own machine.
'''

import os
from datetime import datetime
from fastapi import APIRouter
from sqlmodel import Session

from models.keys import ApiCredentials


##########
# Router
##########

'''
Declared once here and imported by every route file, so every credential route
shares one prefix and one tag no matter which file it is written in.
'''
router = APIRouter(
    prefix="/keys",      #localhost....8000/keys + routes designed
    tags=["API Keys"],   #Tag API Keys
)


##########
# Configuration
##########

#Single-user app: the credentials row always lives at this fixed primary key.
CREDENTIALS_ROW_ID = 1


####
# Getters or Helper Functions
####

def get_credentials_record(session: Session) -> ApiCredentials | None:
    '''
    Read the single stored credentials row, if the user has saved one.
    '''
    return session.get(ApiCredentials, CREDENTIALS_ROW_ID)


def save_credentials_record(
    session: Session,
    spotify_client_id: str | None = None,
    spotify_client_secret: str | None = None,
    canvas_url: str | None = None,
    canvas_token: str | None = None,
    anthropic_key: str | None = None,
) -> ApiCredentials:
    '''
    1-Load the existing credentials row, or start a new one at the fixed id
    2-Update only the fields the user actually filled in
    3-Persist it to the database
    4-Return the saved row

    Every field defaults to None because the settings page saves one service at
    a time: the Canvas tab sends Canvas fields and nothing else.
    '''
    #1-)Reuse the existing row if we have one, otherwise create it
    credentials = session.get(ApiCredentials, CREDENTIALS_ROW_ID) or ApiCredentials(
        id=CREDENTIALS_ROW_ID
    )
    #2-)A blank field means "leave this one alone", not "erase it"
    if spotify_client_id:
        credentials.spotify_client_id = spotify_client_id
    if spotify_client_secret:
        credentials.spotify_client_secret = spotify_client_secret
    if canvas_url:
        credentials.canvas_url = canvas_url
    if canvas_token:
        credentials.canvas_token = canvas_token
    if anthropic_key:
        credentials.anthropic_key = anthropic_key
    credentials.updated_at = datetime.utcnow()
    #3-)Persist the row
    session.add(credentials)
    session.commit()
    session.refresh(credentials)
    #4-)Hand the saved row back to the caller
    return credentials


def get_stored_spotify_config(session: Session) -> tuple[str, str] | None:
    '''
    The Spotify client id and secret the user saved, or None if they never did.

    Read through resolve_spotify_config() below rather than directly, unless you
    specifically want "what did the user type in", as the settings page does.
    '''
    credentials = get_credentials_record(session)
    if not credentials:
        return None
    if not credentials.spotify_client_id or not credentials.spotify_client_secret:
        return None
    return credentials.spotify_client_id, credentials.spotify_client_secret


def get_stored_canvas_config(session: Session) -> tuple[str, str] | None:
    '''
    The Canvas host and access token the user saved, or None if they never did.
    '''
    credentials = get_credentials_record(session)
    if not credentials:
        return None
    if not credentials.canvas_url or not credentials.canvas_token:
        return None
    return credentials.canvas_url, credentials.canvas_token


def get_stored_anthropic_key(session: Session) -> str | None:
    '''
    The Claude API key the user saved, or None if they never did.
    '''
    credentials = get_credentials_record(session)
    if not credentials:
        return None
    return credentials.anthropic_key or None


####
# Resolvers - what each service actually runs on
####

'''
The saved keys win, and the environment is only the fallback.

That order is the whole point of the settings page: a user who pastes their
keys into FocusLab expects those to be the ones in use, without editing a file
or restarting anything. A .env still works for a checkout that never opens the
page - the dev setup, and a fresh install before anyone has typed anything -
but the moment a key is saved, that key is the one that gets used.
'''


def resolve_spotify_config(session: Session) -> tuple[str, str] | None:
    '''
    The Spotify client id and secret to authenticate with, or None if neither
    the settings page nor the environment has a complete pair.
    '''
    #1-)What the user saved on the settings page
    stored = get_stored_spotify_config(session)
    if stored:
        return stored
    #2-)Falls back to a .env, which is all a fresh checkout has
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    if client_id and client_secret:
        return client_id, client_secret
    #3-)Spotify cannot be connected at all until one of the two is filled in
    return None


def resolve_canvas_config(session: Session) -> tuple[str, str] | None:
    '''
    The Canvas host and token to call with, or None if neither source has both.
    '''
    stored = get_stored_canvas_config(session)
    if stored:
        return stored
    canvas_url = os.getenv("CANVAS_URL")
    canvas_token = os.getenv("CANVAS_TOKEN")
    if canvas_url and canvas_token:
        return canvas_url, canvas_token
    return None


def resolve_anthropic_key(session: Session) -> str | None:
    '''
    The Claude API key the agent should run on, or None if there is not one.
    '''
    stored = get_stored_anthropic_key(session)
    if stored:
        return stored
    #ANTHROPIC_KEY is the name Client_MCP/.env uses, ANTHROPIC_API_KEY the SDK's
    return os.getenv("ANTHROPIC_KEY") or os.getenv("ANTHROPIC_API_KEY")


####
# Sources - which of the two a service is running on, for the settings page
####

def describe_active_source(session: Session) -> str:
    '''
    Which set of credentials Spotify is actually using right now.

    Named before the other two services existed, which is why this one is not
    describe_spotify_source. The settings page shows it so a user can tell a
    key that is in use from one a .env is quietly overriding - which, since
    saved keys now win, is only ever the other way round: an environment
    reading means nothing has been saved for that service.
    '''
    #1-)Saved keys win, see the resolvers above
    if get_stored_spotify_config(session):
        return "database"
    #2-)Nothing saved, so a .env is what apis/spotify/OAuth_Logic.py falls back to
    if os.getenv("SPOTIFY_CLIENT_ID") and os.getenv("SPOTIFY_CLIENT_SECRET"):
        return "environment"
    #3-)Nothing anywhere, so Spotify cannot be connected at all
    return "none"


def describe_canvas_source(session: Session) -> str:
    '''
    Which Canvas credentials the Canvas routes are actually using right now.
    '''
    #1-)Saved keys win
    if get_stored_canvas_config(session):
        return "database"
    #2-)Nothing saved, so _canvas() in apis/canvas/core.py falls back to a .env
    if os.getenv("CANVAS_URL") and os.getenv("CANVAS_TOKEN"):
        return "environment"
    #3-)Nothing anywhere, so the Canvas routes answer "Canvas is not configured"
    return "none"


def describe_anthropic_source(session: Session) -> str:
    '''
    Which Claude key the agent is actually running on right now.
    '''
    #1-)Saved keys win
    if get_stored_anthropic_key(session):
        return "database"
    #2-)Nothing saved, so Client_MCP falls back to its own .env
    if os.getenv("ANTHROPIC_KEY") or os.getenv("ANTHROPIC_API_KEY"):
        return "environment"
    #3-)Nothing anywhere, so FocusAI and the AI Study page cannot run
    return "none"
