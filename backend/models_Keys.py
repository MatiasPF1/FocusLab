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
Keys the user pastes into the setup page instead of us shipping our own.

Each desktop install registers its own Spotify app, which is what sidesteps
Spotify's 25-user Development Mode allowlist: every user is user #1 of their
own app rather than one of 25 slots in ours.
'''

#                                    Colummns Construction
#   ┌────────────────────────────────────────────┐
#   │              APICREDENTIALS                │
#   ├──────────────┬────────────────────────┬────┤
#   │ int          │ id                     │ PK │ "single-row table, always id=1"
#   │ string|None  │ spotify_client_id      │    │ "which Spotify app is this install using?"
#   │ string|None  │ spotify_client_secret  │    │ "that app's secret, pasted by the user"
#   │ datetime     │ updated_at             │    │ "when were these keys last saved?"
#   └──────────────┴────────────────────────┴────┘
#
#   A new service later (an AI key for the AI Study page, say) becomes a new
#   pair of columns here rather than a second table.

class ApiCredentials(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    spotify_client_id: str | None = None
    spotify_client_secret: str | None = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


##########
# Schemas - shapes the API accepts and returns
##########

class ApiCredentialsUpdate(SQLModel):
    '''
    What the setup page sends. Both fields are optional so the user can save
    one without blanking the other.
    '''
    spotify_client_id: str | None = None
    spotify_client_secret: str | None = None


class ApiCredentialsStatus(SQLModel):
    '''
    What the setup page reads back.

    The secret is never returned, only whether one is stored, so a saved key
    can be confirmed in the UI without it being readable from the API again.
    '''
    spotify_client_id: str | None            # Not secret, safe to show back
    spotify_client_secret_set: bool          # Only ever whether one exists
    updated_at: datetime | None
    active_source: str                       # "environment" | "database" | "none"
