'''
The Spotify router, and nothing else.

It lives alone in this file so that both halves of the Spotify code can attach
routes to it without importing each other: OAuth_Logic.py owns the login flow
and the token lifecycle, core.py owns calling the Web API, and core.py already
depends on OAuth_Logic.py for a valid token. Declaring the router in either of
them would close that line into a circle.
'''

from fastapi import APIRouter


'''
Declared once here and imported by every file that declares a Spotify route, so
they all share one prefix and one tag no matter which file they are written in.
'''
router = APIRouter(
    prefix="/spotify",   #localhost....8000/spotify + routes desgined
    tags=["Spotify"],    #Tag Spoti1fy
)
