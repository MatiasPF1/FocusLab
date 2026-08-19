'''
Every To-Do route, one file per HTTP method.

Importing a module here runs its @router decorators, which is what attaches
those routes to the shared router in apis/todo/core.py. That side effect is the
only reason these imports exist.
'''

from apis.todo.routes import get, post, patch, delete  # noqa: F401 - importing registers the routes
