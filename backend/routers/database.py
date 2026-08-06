import os
from collections.abc import Generator
from sqlmodel import Session, SQLModel, create_engine


##########
# Setup
##########

'''
1-Read the DB location from .env, fallback to a default file path
2-Create the engine (the object that manages actual connections to SQLite)
'''

#1-)Database URL, e.g. sqlite:////app/data/focuslab.db (falls back if not set in .env)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:////app/data/focuslab.db",
)

#2-)Engine manages the actual connections to the SQLite file
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},   # Allows SQLite to be used across FastAPI's threads
)


##########
# Functions
##########

def create_db_and_tables():
    '''
    1-Import models so SQLModel knows every table that needs to exist
    2-Create Tables
    '''
    #1-)Importing models registers every table class with SQLModel's metadata
    import models
    #2-)Creates tables that don't exist yet (does nothing to tables that already exist)
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    '''
    1-Open a new Session for a single request
    2-Hand it to the route via yield
    3-Session closes automatically once the request finishes
    '''
    #1-)+2-)+3-) with-block opens the session, yields it, then closes it when the request is done
    with Session(engine) as session:
        yield session