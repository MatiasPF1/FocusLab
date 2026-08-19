'''
Spotify API.

Importing this package hands back a router with every Spotify route already
attached. The routes live in two places, so both are imported below: the OAuth
flow in OAuth_Logic.py, and everything else in routes/, one file per HTTP
method.
'''

from apis.spotify.router import router
from apis.spotify import OAuth_Logic  # noqa: F401 - registers status, token, login, callback
from apis.spotify import routes       # noqa: F401 - registers the rest

__all__ = ["router"]
