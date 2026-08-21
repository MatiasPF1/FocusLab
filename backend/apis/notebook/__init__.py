'''
Notebook API.

Importing this package hands back a router with every Notebook route already
attached: importing .routes below runs the decorators in each verb file.
'''

from apis.notebook.core import router
from apis.notebook import routes  # noqa: F401 - importing registers the routes

__all__ = ["router"]
