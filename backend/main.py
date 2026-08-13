import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers.database import create_db_and_tables

'''
Each resource owns one router, declared in routers/spotify.py and
routers/queues.py, while its routes are written across a _get and a _post file.

Importing those four modules is what runs their @router decorators and attaches
the routes. They look unused because nothing calls them by name, so do not let
an editor "clean up" these imports: without them both routers arrive empty.
'''
from routers import queues_get, queues_post, spotify_get, spotify_post  # noqa: F401
from routers.queues import router as queues_router
from routers.spotify import router as spotify_router

#0-Load backend /.env before routes read configuration from the environment.
load_dotenv(Path(__file__).with_name(".env"))


#1-App Initialization
app = FastAPI(
    title="FocusLab API",
    version="0.1.0",
)


##########
# CORS
##########

'''
CORS decides which websites' JavaScript is allowed to read answers from this
API. It is enforced by the browser, not by us.

What it stops:
-a page on some other site, open in the same browser, quietly
calling this API in the background and reading the reply.

What it does NOT stop: anything that is not a browser page. curl, a script, a
phone or another app on the machine send no Origin header, so there is nothing
for CORS to check and the request goes through untouched. CORS is not a lock on
the API, and the only thing keeping this backend private is which network
address it is published on.
'''

#2-)Which origins may read our answers. Comma separated in .env to add more.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

#2.1-)Exactly the methods the frontend uses, OPTIONS included for preflight checks
ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

'''
2.2-)Exactly the request headers the frontend sends:
  Content-Type   -> so JSON bodies are accepted on POST, PUT and PATCH
  Authorization  -> reserved for when this API starts authenticating callers
'''
ALLOWED_HEADERS = ["Content-Type", "Authorization"]

#2.3-)How long a browser may cache the preflight answer, in seconds (10 minutes)
PREFLIGHT_CACHE_SECONDS = 600

#3-Middleware to allow Next.js frontend to communicate with FastAPI Safetely
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,       # Only these sites may read our answers
    allow_credentials=True,              # Lets the OAuth state cookie travel
    allow_methods=ALLOWED_METHODS,       # Methods allowed
    allow_headers=ALLOWED_HEADERS,       # Request headers allowed
    max_age=PREFLIGHT_CACHE_SECONDS,     # Saves repeating the preflight request
)


#4-Create database tables (Queue, QueueTrack, SpotifyToken) on startup if they don't exist yet
@app.on_event("startup")
def on_startup():
    create_db_and_tables()


##########
# Routers
##########

'''
Both routers are already carrying every route by this point, because importing
the _get and _post modules above ran their decorators. FastAPI matches on method
as well as path, so /queues GET and /queues POST live in different files without
ever clashing.
'''

# Connect Spotify routes to the main application
app.include_router(spotify_router)

# Connect Queue routes to the main application
app.include_router(queues_router)
