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

'''
Columns added to a table after it already existed in someone's database file.

create_all() below builds missing TABLES and nothing else - it will not touch a
table that is already there, so a model that grows a field would read back as
"no such column" against an older file. Each entry here is applied once, on
startup, and is a no-op from then on.

    table -> column name -> the SQLite type and default to add it with
'''
_ADDED_COLUMNS = {
    "note": {
        # The Notebook's cover art. Added after the To-Do notes shipped.
        "cover": "TEXT NOT NULL DEFAULT ''",
    },
}


def _add_missing_columns():
    '''
    1-Look at what each table actually has right now
    2-Add only the columns from _ADDED_COLUMNS that are not there yet
    '''
    with engine.connect() as connection:
        for table, columns in _ADDED_COLUMNS.items():
            #1-)PRAGMA returns a row per column; an empty result means the table
            #   does not exist yet, in which case create_all builds it complete
            present = {row[1] for row in connection.exec_driver_sql(f"PRAGMA table_info({table})")}
            if not present:
                continue
            #2-)Anything already present is skipped, so this is safe to re-run
            for name, definition in columns.items():
                if name not in present:
                    connection.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")
        connection.commit()


def create_db_and_tables():
    '''
    1-Import models so SQLModel knows every table that needs to exist
    2-Create Tables
    3-Bring older database files up to date with columns added since
    '''
    #1-)Importing models registers every table class with SQLModel's metadata
    import models  # noqa: F401 - its __init__ imports every model module
    #2-)Creates tables that don't exist yet (does nothing to tables that already exist)
    SQLModel.metadata.create_all(engine)
    #3-)Which is why the columns have to be handled separately
    _add_missing_columns()


def get_session() -> Generator[Session, None, None]:
    '''
    1-Open a new Session for a single request
    2-Hand it to the route via yield
    3-Session closes automatically once the request finishes
    '''
    #1-)+2-)+3-) with-block opens the session, yields it, then closes it when the request is done
    with Session(engine) as session:
        yield session