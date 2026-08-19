'''
Credential routing resources - GET only.

Every route here only reads: it reports which keys are stored and which set is
actually in use. Nothing in this file saves anything, and the stored secret is
never sent back out.

The route that DOES save keys lives beside this file in
apis/Retrieving_Keys/routes/post.py.
The router and the shared plumbing they all use live in
apis/Retrieving_Keys/core.py.
'''

from fastapi import Depends
from sqlmodel import Session

from models_Keys import ApiCredentialsStatus
from database import get_session
from apis.Retrieving_Keys.core import (
    describe_active_source,
    get_credentials_record,
    router,
)


##########
# Routed Resources
##########

'''
/keys/status   --> (Reports which keys are saved, without ever revealing the secret)
'''


##########
# Routes
##########

@router.get("/status", response_model=ApiCredentialsStatus)
def get_credentials_status(session: Session = Depends(get_session)):
    '''
    1-Read the saved credentials row, if the user ever filled the form in
    2-Report the client id, but only whether a secret exists
    3-Say which set of credentials Spotify would actually use right now

    The setup page calls this on load so it can show "already saved" without
    the secret ever travelling back over the wire.
    '''
    #1-)Nothing saved yet is a normal state, not an error
    credentials = get_credentials_record(session)
    #2-)The client id is not a secret, the secret is reduced to a yes/no
    return ApiCredentialsStatus(
        spotify_client_id=credentials.spotify_client_id if credentials else None,
        spotify_client_secret_set=bool(
            credentials and credentials.spotify_client_secret
        ),
        updated_at=credentials.updated_at if credentials else None,
        #3-)Environment still wins today, see get_stored_spotify_config()
        active_source=describe_active_source(session),
    )
