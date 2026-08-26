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

from models.keys import ApiCredentialsStatus, ApiCredentialsUpdate
from database import get_session
from apis.Retrieving_Keys.core import (
    describe_active_source,
    describe_anthropic_source,
    describe_canvas_source,
    save_credentials_record,
    router,
)


##########
# Routed Resources
##########

'''
/keys   --> (Saves whichever service's keys the user pasted in: Spotify, Canvas or Claude)
'''


####
# Helper Functions
####

def normalize_canvas_url(raw: str) -> str:
    '''
    The Canvas host, in the one shape apis/canvas/core.py can use.

    That file builds its base URL as f"{base}/api/v1", so a trailing slash or a
    pasted "/courses" path silently produces a URL Canvas 404s on. People copy
    this out of their browser's address bar, so both are the normal case rather
    than the exception, and a scheme is usually missing entirely.
    '''
    #1-)A bare "school.instructure.com" is what most people type
    host = raw.strip()
    if host and "://" not in host:
        host = f"https://{host}"
    #2-)Keep the scheme and host, drop any path the address bar came with
    scheme, _, rest = host.partition("://")
    return f"{scheme}://{rest.split('/')[0]}" if rest else ""


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
    4-Report back the same shape /keys/status returns, secrets still withheld

    The settings page saves one service at a time, so a request normally
    carries only the two Spotify fields, or the two Canvas ones, or the Claude
    key. Everything it leaves out is left exactly as it was.
    '''
    #1-)A stray trailing space in a key fails authentication in a way that looks
    #   like a wrong key, so strip it here rather than debug it later
    client_id = (payload.spotify_client_id or "").strip()
    client_secret = (payload.spotify_client_secret or "").strip()
    canvas_url = normalize_canvas_url(payload.canvas_url or "")
    canvas_token = (payload.canvas_token or "").strip()
    anthropic_key = (payload.anthropic_key or "").strip()

    #2-)Every field blank means the form was submitted empty
    if not any((client_id, client_secret, canvas_url, canvas_token, anthropic_key)):
        raise HTTPException(
            status_code=400,
            detail="Enter at least one key before saving",
        )

    #3-)Blank fields are left alone rather than erased, see save_credentials_record
    credentials = save_credentials_record(
        session,
        spotify_client_id=client_id or None,
        spotify_client_secret=client_secret or None,
        canvas_url=canvas_url or None,
        canvas_token=canvas_token or None,
        anthropic_key=anthropic_key or None,
    )

    #4-)Same response shape as /keys/status so the page can reuse one handler
    return ApiCredentialsStatus(
        spotify_client_id=credentials.spotify_client_id,
        spotify_client_secret_set=bool(credentials.spotify_client_secret),
        canvas_url=credentials.canvas_url,
        canvas_token_set=bool(credentials.canvas_token),
        anthropic_key_set=bool(credentials.anthropic_key),
        updated_at=credentials.updated_at,
        active_source=describe_active_source(session),
        canvas_source=describe_canvas_source(session),
        anthropic_source=describe_anthropic_source(session),
    )
