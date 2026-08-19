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
    spotify_client_id: str | None,
    spotify_client_secret: str | None,
) -> ApiCredentials:
    '''
    1-Load the existing credentials row, or start a new one at the fixed id
    2-Update only the fields the user actually filled in
    3-Persist it to the database
    4-Return the saved row
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

    NOT WIRED UP YET - nothing calls this today.

    Spotify still reads its credentials from the environment, in
    get_spotify_config() over in apis/spotify/OAuth_Logic.py. This function is the
    other half of the switch: when the desktop build is ready to stop shipping
    a .env, that function starts calling this one and falls back to the
    environment only when the user has saved nothing. Keeping the fallback is
    what lets the web dev setup keep working unchanged.
    '''
    credentials = get_credentials_record(session)
    if not credentials:
        return None
    if not credentials.spotify_client_id or not credentials.spotify_client_secret:
        return None
    return credentials.spotify_client_id, credentials.spotify_client_secret


def describe_active_source(session: Session) -> str:
    '''
    Which set of credentials Spotify would actually use right now.

    The setup page shows this so a user who pastes keys while a .env is still
    present can see that the environment is the one winning.
    '''
    #1-)The environment is still what apis/spotify/OAuth_Logic.py reads, so it wins
    if os.getenv("SPOTIFY_CLIENT_ID") and os.getenv("SPOTIFY_CLIENT_SECRET"):
        return "environment"
    #2-)Saved keys are stored and ready, waiting on the wiring described above
    if get_stored_spotify_config(session):
        return "database"
    #3-)Nothing anywhere, so Spotify cannot be connected at all yet
    return "none"
