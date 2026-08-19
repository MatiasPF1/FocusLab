'''
Queues API.

Importing this package hands back a router with every Queues route already
attached: importing .routes below runs the decorators in each verb file.
'''

from apis.queues.core import router
from apis.queues import routes  # noqa: F401 - importing registers the routes

__all__ = ["router"]
