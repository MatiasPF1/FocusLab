'''
Canvas LMS API.

Importing this package hands back a router with every Canvas route already
attached: importing .routes below runs the decorators in each verb file.

core.py holds plain functions with no FastAPI and no MCP in them, so the same
code serves the API routes here and the MCP server in FocusLab_MCP/.
'''

from apis.canvas.router import router
from apis.canvas import routes  # noqa: F401 - importing registers the routes

__all__ = ["router"]
