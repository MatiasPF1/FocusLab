'''
Every Spotify route that is not part of the OAuth flow, one file per HTTP
method. The login flow and the token lifecycle live in
apis/spotify/OAuth_Logic.py instead.

Importing a module here runs its @router decorators, which is what attaches
those routes to the shared router in apis/spotify/router.py. That side effect
is the only reason these imports exist.
'''

from apis.spotify.routes import get, put, post  # noqa: F401 - importing registers the routes
