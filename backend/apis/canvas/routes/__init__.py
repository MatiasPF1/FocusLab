'''
Every Canvas route, one file per HTTP method.

Importing a module here runs its @router decorators, which is what attaches
those routes to the shared router in apis/canvas/router.py. That side effect is
the only reason these imports exist.
'''

from apis.canvas.routes import get  # noqa: F401 - importing registers the routes
