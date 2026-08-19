'''
To-Do API.

Importing this package hands back a router with every To-Do route already
attached: importing .routes below runs the decorators in each verb file.
'''

from apis.todo.core import router
from apis.todo import routes  # noqa: F401 - importing registers the routes

__all__ = ["router"]
