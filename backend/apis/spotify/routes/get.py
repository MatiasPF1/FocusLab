'''
Spotify routing resources - GET only.

Every route here only reads what Spotify already knows: what is playing, which
devices are reachable, and search results. Nothing in this file changes what
Spotify is doing, and nothing here is part of the login flow.

The OAuth routes - login, callback, status and token - live in
apis/spotify/OAuth_Logic.py, together with the token lifecycle they share.
The commands that DO change playback live beside this file in
apis/spotify/routes/put.py and post.py.
'''

from fastapi import Depends, HTTPException
from sqlmodel import Session

from database import get_session
from apis.spotify.router import router
from apis.spotify.core import (
    get_devices,
    spotify_api_get,
    spotify_api_request,
)


##########
# Routed Resources
##########

'''
/spotify/player            --> (What is playing right now, trimmed to what the UI needs)
/spotify/devices           --> (Every Spotify app this account is signed in to)
/spotify/search            --> (Track search, used when adding songs to a queue)
/spotify/recently-played   --> (The last songs played on this account)
'''


##########
# Routes
##########

@router.get("/player")
async def get_player_state(session: Session = Depends(get_session)):
    '''
    1-Ask Spotify what is playing right now
    2-Report "nothing playing" when Spotify has no session to describe
    3-Return just the bits the player controls need
    '''
    #1-)Returns an empty body when there is no active device at all
    data = await spotify_api_request(session, "GET", "/me/player")

    #2-)No session means nothing to show, and that is not an error
    if not data:
        return {
            "is_playing": False,
            "track_uri": None,
            "track_name": None,
            "artist_name": None,
            "image_url": None,
            "device_name": None,
        }

    #3-)Flatten Spotify's nested shape into what the UI actually renders
    item = data.get("item") or {}
    artists = ", ".join(
        artist["name"]
        for artist in item.get("artists", [])
        if artist.get("name")
    )
    #3.1-)Spotify lists images largest first, so the last one is the thumbnail
    images = (item.get("album") or {}).get("images") or []
    return {
        "is_playing": bool(data.get("is_playing")),
        "track_uri": item.get("uri"),
        "track_name": item.get("name"),
        "artist_name": artists or None,
        "image_url": images[-1].get("url") if images else None,
        "device_name": (data.get("device") or {}).get("name"),
    }


@router.get("/devices")
async def list_spotify_devices(session: Session = Depends(get_session)):
    '''
    1-Ask Spotify which of this account's apps are reachable
    2-Keep only the fields the UI needs to name a device
    '''
    #1-)+2-) Devices without an id cannot be targeted, so they are of no use here
    devices = await get_devices(session)
    return [
        {
            "id": device.get("id"),
            "name": device.get("name"),
            "type": device.get("type"),
            "is_active": bool(device.get("is_active")),
        }
        for device in devices
        if device.get("id")
    ]


@router.get("/search")
async def search_tracks(
    q: str,
    limit: int = 20,
    session: Session = Depends(get_session),
):
    '''
    1-Reject empty searches and out-of-range page sizes
    2-Ask Spotify to search its catalogue for songs
    3-Keep only the few fields the frontend shows
    4-Return the results
    '''
    #1-)An empty query would just make Spotify answer with an error
    query = q.strip()
    if not query:
        raise HTTPException(
            status_code=400,
            detail="Search query cannot be empty",
        )
    #1.1-)Spotify allows at most 50 results per request
    limit = max(1, min(limit, 50))

    #2-)"type=track" keeps albums and podcast episodes out of the results
    data = await spotify_api_get(
        session,
        "/search",
        {"q": query, "type": "track", "limit": limit},
    )

    #3-)Trim each hit down to exactly what a queue track needs
    results = []
    for track in (data.get("tracks") or {}).get("items", []):
        #3.1-)Spotify occasionally returns null entries, skip them
        if not track or not track.get("uri"):
            continue
        #3.2-)A song can have several artists, join them into one readable line
        artists = ", ".join(
            artist["name"]
            for artist in track.get("artists", [])
            if artist.get("name")
        )
        images = (track.get("album") or {}).get("images") or []
        results.append({
            "track_uri": track["uri"],
            "track_name": track.get("name") or "Untitled track",
            "artist_name": artists or "Unknown artist",
            #3.3-)Spotify lists images largest first, so the last one is the thumbnail
            "image_url": images[-1].get("url") if images else None,
        })
    #4-)Return the trimmed results
    return results


@router.get("/recently-played")
async def get_recently_played(
    limit: int = 5,
    session: Session = Depends(get_session),
):
    '''
    1-Ask Spotify for the account's actual listening history
    2-Keep only the fields the UI needs, oldest duplicates aside
    3-Return the trimmed list

    Requires the user-read-recently-played scope, which older connections made
    before this route existed will not have. Spotify answers a plain 403 for
    that, which spotify_api_request already turns into a normal HTTP error —
    the frontend treats a failed fetch here as "nothing to show" rather than
    a scary error, since this list is a nice-to-have, not core functionality.
    '''
    #1-)Spotify allows at most 50 entries per request; this panel needs a handful
    limit = max(1, min(limit, 50))
    data = await spotify_api_get(
        session,
        "/me/player/recently-played",
        {"limit": limit},
    )

    #2-)Same song played twice in a row would otherwise show up as two rows
    seen_uris: set[str] = set()
    results = []
    for entry in data.get("items", []):
        track = entry.get("track") or {}
        track_uri = track.get("uri")
        if not track_uri or track_uri in seen_uris:
            continue
        seen_uris.add(track_uri)

        artists = ", ".join(
            artist["name"]
            for artist in track.get("artists", [])
            if artist.get("name")
        )
        results.append({
            "track_uri": track_uri,
            "track_name": track.get("name") or "Untitled track",
            "artist_name": artists or "Unknown artist",
        })
    #3-)Return the trimmed, de-duplicated list
    return results
