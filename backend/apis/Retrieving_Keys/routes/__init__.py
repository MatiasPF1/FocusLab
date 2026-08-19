'''
Every credential route, one file per HTTP method.

Importing a module here runs its @router decorators, which is what attaches
those routes to the shared router in apis/Retrieving_Keys/core.py. That side
effect is the only reason these imports exist.
'''

from apis.Retrieving_Keys.routes import get, post  # noqa: F401 - importing registers the routes
