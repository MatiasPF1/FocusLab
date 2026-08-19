'''
Retrieving Keys API.

Importing this package hands back a router with every credential route already
attached: importing .routes below runs the decorators in each verb file.
'''

from apis.Retrieving_Keys.core import router
from apis.Retrieving_Keys import routes  # noqa: F401 - importing registers the routes

__all__ = ["router"]
