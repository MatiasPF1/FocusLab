'''
Credential routing resources - GET only.

Every route here only reads: they report which keys are stored, which set is
actually in use, and - for the agent service alone - what those keys are.
Nothing in this file saves anything.

The route that DOES save keys lives beside this file in
apis/Retrieving_Keys/routes/post.py.
The router and the shared plumbing they all use live in
apis/Retrieving_Keys/core.py.
'''

from fastapi import Depends
from sqlmodel import Session

from models.keys import ApiCredentialsStatus, ResolvedSecrets
from database import get_session
from apis.Retrieving_Keys.core import (
    describe_active_source,
    describe_anthropic_source,
    describe_canvas_source,
    get_credentials_record,
    resolve_anthropic_key,
    resolve_canvas_config,
    router,
)


##########
# Routed Resources
##########

'''
/keys/status     --> (Reports which keys are saved, without ever revealing a secret)
/keys/resolved   --> (Hands the agent service the keys it runs on - the one route that does)
'''


##########
# Routes
##########

@router.get("/status", response_model=ApiCredentialsStatus)
def get_credentials_status(session: Session = Depends(get_session)):
    '''
    1-Read the saved credentials row, if the user ever filled the form in
    2-Report the non-secret fields, but only whether each secret exists
    3-Say which set of credentials each service would actually use right now

    The settings page calls this on load so every tab can show "already saved"
    without a secret ever travelling back over the wire.
    '''
    #1-)Nothing saved yet is a normal state, not an error
    credentials = get_credentials_record(session)
    #2-)The client id and the Canvas host are not secrets; the rest are reduced
    #   to a yes/no
    return ApiCredentialsStatus(
        spotify_client_id=credentials.spotify_client_id if credentials else None,
        spotify_client_secret_set=bool(
            credentials and credentials.spotify_client_secret
        ),
        canvas_url=credentials.canvas_url if credentials else None,
        canvas_token_set=bool(credentials and credentials.canvas_token),
        anthropic_key_set=bool(credentials and credentials.anthropic_key),
        updated_at=credentials.updated_at if credentials else None,
        #3-)"database" once a key is saved, since saved keys win over a .env
        active_source=describe_active_source(session),
        canvas_source=describe_canvas_source(session),
        anthropic_source=describe_anthropic_source(session),
    )


@router.get("/resolved", response_model=ResolvedSecrets)
def get_resolved_secrets(session: Session = Depends(get_session)):
    '''
    1-Resolve the Canvas credentials the same way the Canvas routes do
    2-Resolve the Claude key the same way
    3-Hand both back, secrets included

    The one route in this API that returns a stored secret, and it exists for
    the FocusAI agent: it runs as its own process - its own container under
    compose - so it can open neither the database file nor a .env of the
    user's. Without this it would have no way to learn the keys the settings
    page saved, which is exactly what the page is now for.

    Callers: Client_MCP/keys.py, and apis/canvas/core.py when it is the copy
    running inside the agent rather than inside this backend.

    Nothing in the browser calls this. Spotify is deliberately not here, since
    it never leaves this process.
    '''
    #1-)Saved keys first, environment second - resolve_* owns that order
    canvas = resolve_canvas_config(session)
    #2-)Same order again for Claude
    anthropic_key = resolve_anthropic_key(session)
    #3-)None for anything that is not configured either way, which reads to the
    #   caller as "fall back to whatever you have locally"
    return ResolvedSecrets(
        canvas_url=canvas[0] if canvas else None,
        canvas_token=canvas[1] if canvas else None,
        anthropic_key=anthropic_key,
    )
