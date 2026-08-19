from sqlmodel import SQLModel, Field


#PK: Primary Key

##########
# Model For Spotify tokens
##########

'''
The one row that says FocusLab is currently allowed to act on a Spotify
account. Written by the OAuth callback and kept fresh by the refresh helper,
both in apis/spotify/OAuth_Logic.py.
'''

#   ┌──────────────────────────────┐
#   │         SPOTIFYTOKEN         │
#   ├──────────────┬─────────────┬─┤
#   │ int          │ id          │PK│ "single-row table, always id=1"
#   │ string       │ access_token│  │ "short-lived token used to call Spotify's API"
#   │ string|None  │ refresh_token│ │ "long-lived token used to get new access tokens"
#   │ float        │ expires_at  │  │ "unix timestamp when access_token expires"
#   └──────────────┴─────────────┴──┘

class SpotifyToken(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    access_token: str
    refresh_token: str | None = None
    expires_at: float = 0.0
