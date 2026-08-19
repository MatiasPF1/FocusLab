'''
Credential routing resources - POST.

Saving the keys the user pasted into the setup page. This is the only route
that writes credentials.

The read-only route lives beside this file in
apis/Retrieving_Keys/routes/get.py.
The router and the shared plumbing they all use live in
apis/Retrieving_Keys/core.py.
'''

from fastapi import Depends, HTTPException
from sqlmodel import Session

from models_Keys import ApiCredentialsStatus, ApiCredentialsUpdate
from database import get_session
from apis.Retrieving_Keys.core import (
    describe_active_source,
    save_credentials_record,
    router,
)


##########
# Routed Resources
##########

'''
/keys   --> (Saves the Spotify client id and secret the user pasted in)
'''


##########
# Routes
##########

@router.post("", response_model=ApiCredentialsStatus, status_code=201)
def save_credentials(
    payload: ApiCredentialsUpdate,
    session: Session = Depends(get_session),
):
    '''
    1-Trim what the user pasted, since copying from a dashboard picks up spaces
    2-Refuse a request that would save nothing at all
    3-Save the row
    4-Report back the same shape /keys/status returns, secret still withheld
    '''
    #1-)A stray trailing space in a client id fails authentication in a way that
    #   looks like a wrong key, so strip it here rather than debug it later
    client_id = (payload.spotify_client_id or "").strip()
    client_secret = (payload.spotify_client_secret or "").strip()

    #2-)Both fields blank means the form was submitted empty
    if not client_id and not client_secret:
        raise HTTPException(
            status_code=400,
            detail="Enter at least one key before saving",
        )

    #3-)Blank fields are left alone rather than erased, see save_credentials_record
    credentials = save_credentials_record(
        session,
        spotify_client_id=client_id or None,
        spotify_client_secret=client_secret or None,
    )

    #4-)Same response shape as /keys/status so the page can reuse one handler
    return ApiCredentialsStatus(
        spotify_client_id=credentials.spotify_client_id,
        spotify_client_secret_set=bool(credentials.spotify_client_secret),
        updated_at=credentials.updated_at,
        active_source=describe_active_source(session),
    )
