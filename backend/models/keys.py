from datetime import datetime
from sqlmodel import SQLModel, Field


# FocusLab is being built as a DESKTOP app (one install per user, backend on
# localhost), not a hosted web app, so a single-row credentials table and
# storing user-supplied keys locally are cool


#PK: Primary Key

##########
# Model For user-supplied API credentials
##########

'''
Keys the user pastes into the settings page instead of us shipping our own.

Three services need credentials for FocusLab to run whole:

  Spotify   - the player on the Home page.
  Canvas    - courses, assignments and grades.
  Anthropic - the Claude key FocusAI and the AI Study page run on.

Each desktop install registers its own Spotify app, which is what sidesteps
Spotify's 25-user Development Mode allowlist: every user is user #1 of their
own app rather than one of 25 slots in ours. The Canvas token is per-school and
per-person, and the Anthropic key is billed to whoever pastes it, so neither
could be shipped centrally even if we wanted to.
'''

#                                    Colummns Construction
#   ┌────────────────────────────────────────────┐
#   │              APICREDENTIALS                │
#   ├──────────────┬────────────────────────┬────┤
#   │ int          │ id                     │ PK │ "single-row table, always id=1"
#   │ string|None  │ spotify_client_id      │    │ "which Spotify app is this install using?"
#   │ string|None  │ spotify_client_secret  │    │ "that app's secret, pasted by the user"
#   │ string|None  │ canvas_url             │    │ "which school's Canvas, host only"
#   │ string|None  │ canvas_token           │    │ "that user's Canvas access token"
#   │ string|None  │ anthropic_key          │    │ "the Claude key the agent runs on"
#   │ datetime     │ updated_at             │    │ "when were these keys last saved?"
#   └──────────────┴────────────────────────┴────┘
#
#   A new service later becomes a new column here rather than a second table.

class ApiCredentials(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    spotify_client_id: str | None = None
    spotify_client_secret: str | None = None
    canvas_url: str | None = None
    canvas_token: str | None = None
    anthropic_key: str | None = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


##########
# Schemas - shapes the API accepts and returns
##########

class ApiCredentialsUpdate(SQLModel):
    '''
    What the settings page sends. Every field is optional so the user can save
    one service without blanking the others - the page only ever sends the tab
    they are actually looking at.
    '''
    spotify_client_id: str | None = None
    spotify_client_secret: str | None = None
    canvas_url: str | None = None
    canvas_token: str | None = None
    anthropic_key: str | None = None


class ApiCredentialsStatus(SQLModel):
    '''
    What the settings page reads back.

    A secret is never returned, only whether one is stored, so a saved key can
    be confirmed in the UI without it being readable from the API again. The
    two non-secret fields - which Spotify app, which school - do come back, so
    a returning user sees what they filled in.

    Each *_source says which set of credentials that service would actually use
    right now: "environment", "database" or "none".
    '''
    spotify_client_id: str | None            # Not secret, safe to show back
    spotify_client_secret_set: bool          # Only ever whether one exists
    canvas_url: str | None                   # A school's public Canvas host
    canvas_token_set: bool
    anthropic_key_set: bool
    updated_at: datetime | None
    active_source: str                       # Spotify's, named before the others existed
    canvas_source: str
    anthropic_source: str


class ResolvedSecrets(SQLModel):
    '''
    The credentials the agent service actually runs on, secrets included.

    The one place in this API that hands a stored secret back out, and it exists
    because the FocusAI agent is a separate process: under Docker it mounts
    neither the database volume nor a .env of the user's, so asking the backend
    is the only way it can learn the keys the settings page saved. Only the two
    services that run outside this process are here - Spotify never leaves the
    backend, so its secret never needs to.

    Same trust boundary as the .env file this replaces: anything already running
    on the user's machine could read that file too, and CORS in main.py keeps
    browsers other than FocusLab's own frontend out.
    '''
    canvas_url: str | None
    canvas_token: str | None
    anthropic_key: str | None
