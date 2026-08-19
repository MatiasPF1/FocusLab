'''
The Canvas router, and nothing else.

It lives alone in this file for the same reason the Spotify one does: core.py
must stay free of FastAPI so that FocusLab_MCP/server.py can import it without
dragging a web framework in. Declaring the router there would break that.
'''

from fastapi import APIRouter


'''
Declared once here and imported by every file that declares a Canvas route, so
they all share one prefix and one tag no matter which file they are written in.
'''
router = APIRouter(
    prefix="/canvas",   #localhost....8000/canvas + routes designed
    tags=["Canvas"],    #Tag Canvas
)
