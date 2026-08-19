from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship


#PK: Primary Key
#FK: Foreign Key(Primary Key of other take)

##########
# Models For Queues
##########

#                                    Colummns Construction
#   ┌──────────────────────────┐
#   │           QUEUE          │
#   ├──────────┬────────────┬──┤
#   │ int      │ id         │PK│  "Which playlist queque?"
#   │ string   │ name       │  │  "What is this queque called?"
#   │ datetime │ created_at │  │  "When was this queque made?"
#   └──────────┴─────┬──────┴──┘
#                     │ 1
#                     ┼
#                     │ *
#   ┌─────────────────┴─────────┐
#   │        QUEUE_TRACK        │
#   ├───────────┬────────────┬──┤
#   │ int       │ id         │PK│ "which song of the playlist"
#   │ int       │ queue_id   │FK│ "which queque does this song belong to?"
#   │ string    │ track_uri  │  │ "which exact Spotify song is this?"
#   │ string    │ track_name │  │ "what is this song called?"
#   │ string    │ artist_name│  │ "who made this song?"
#   │ int       │ position   │  │ "where in the queque does this song play?"
#   └───────────┴────────────┴──┘


#                                            Example 
#   ┌────────────────────────────────────────────────────────┐
#   │                        queue table                     │
#   ├────┬─────────────┬───────────────────┬──────────────────┤
#   │ id │ name        │ created_at        │                  │
#   ├────┼─────────────┼───────────────────┼──────────────────┤
#   │ 1  │ Deep Focus  │ 2026-08-06 14:00  │                  │
#   │ 2  │ Study Break │ 2026-08-06 15:00  │                  │
#   └────┴─────────────┴───────────────────┴──────────────────┘
#
#   ┌───────────────────────────────────────────────────────────────────┐
#   │                          queuetrack table                         │
#   ├────┬──────────┬─────────────┬───────────────────┬─────────────────┤
#   │ id │ queue_id │ track_name  │ artist_name        │ position        │
#   ├────┼──────────┼─────────────┼───────────────────┼─────────────────┤
#   │ 1  │ 1        │ Intro       │ The xx             │ 1               │
#   │ 2  │ 1        │ Time        │ Hans Zimmer        │ 2               │
#   │ 3  │ 1        │ Experience  │ Ludovico Einaudi   │ 3               │
#   │ 4  │ 2        │ Sunflower   │ Post Malone        │ 1               │
#   └────┴──────────┴─────────────┴───────────────────┴─────────────────┘
#


class Queue(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)               
    name: str                                                           
    created_at: datetime = Field(default_factory=datetime.utcnow)         
    
    # Relationship Type: one queue -> many tracks, always read back in playing order
    tracks: list["QueueTrack"] = Relationship(
        back_populates="queue",
        sa_relationship_kwargs={"order_by": "QueueTrack.position"},
    )



class QueueTrack(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)    
    queue_id: int = Field(foreign_key="queue.id")              
    track_uri: str                                            
    track_name: str
    artist_name: str
    position: int

    queue: Queue = Relationship(back_populates="tracks")           # Relationship back to the parent queue


##########
# Schemas  - shapes the API accepts and returns
##########

'''
Table models above describe what the database stores.
The schemas below describe what a request may send and what a response gives back,
so clients can never set things like id or created_at themselves.
'''

class QueueCreate(SQLModel):
    name: str                          # The only thing a client sends when creating a queue


class QueueUpdate(SQLModel):
    name: str                          # The only field a client is allowed to change


class QueueTrackCreate(SQLModel):
    '''
    A song the user picked out of Spotify search results.
    The position is decided by the backend (always appended to the end),
    so the client never sends it.
    '''
    track_uri: str
    track_name: str
    artist_name: str


class QueueTrackRead(SQLModel):
    id: int
    queue_id: int
    track_uri: str
    track_name: str
    artist_name: str
    position: int


class QueueRead(SQLModel):
    id: int
    name: str
    created_at: datetime


class QueueReadWithTracks(QueueRead):
    tracks: list["QueueTrack"] = []    # Full queue detail: the queue plus every track inside it
