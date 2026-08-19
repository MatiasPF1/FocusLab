'''
Every Queues route, one file per HTTP method.

Importing a module here runs its @router decorators, which is what attaches
those routes to the shared router in apis/queues/core.py. That side effect is the
only reason these imports exist.
'''

from apis.queues.routes import get, post, patch, delete  # noqa: F401 - importing registers the routes
