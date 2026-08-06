from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship


#PK: Primary Key
#FK: Foreign Key(Primary Key of other take

##########
# Models For Spotify 
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
    
    tracks: list["QueueTrack"] = Relationship(back_populates="queue") # Relationship Type: one queue -> many tracks



class QueueTrack(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)    
    queue_id: int = Field(foreign_key="queue.id")              
    track_uri: str                                            
    track_name: str
    artist_name: str
    position: int

    queue: Queue = Relationship(back_populates="tracks")           # Relationship back to the parent queue

