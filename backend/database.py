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

The apicredentials entries are from when the settings page grew from Spotify
alone to Spotify, Canvas and Claude. A database file written before that has
the table with only the two Spotify columns.

Its other entry was note.cover, from when the Notebook was still writing into
the To-Do table; covers now live on notebook_entry, which is created complete.
A file written before the split keeps that unused column - nothing reads it,
and SQLite cannot drop a column without rebuilding the table.
'''
_ADDED_COLUMNS = {
    "apicredentials": {
        "canvas_url": "VARCHAR",
        "canvas_token": "VARCHAR",
        "anthropic_key": "VARCHAR",
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


def _table_exists(name: str) -> bool:
    '''Whether this database file already has that table.'''
    with engine.connect() as connection:
        found = connection.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (name,),
        ).first()
    return found is not None


def _copy_notes_into_notebook():
    '''
    The Notebook's share of the To-Do table, handed over once.

    Both pages used to read and write the same `note` rows, so every note
    showed up in both places and an edit on one moved the other. The Notebook
    has its own table now, and this copies what was there when that happened so
    the page still shows what it showed the day before. The To-Do rows are left
    exactly where they are - this copies, it does not move. From here the two
    are separate rows and go their own way.

    Called only when notebook_entry has just been created, which happens once
    in the life of a database file, so it cannot run twice and cannot bring
    back entries somebody deleted.
    '''
    with engine.connect() as connection:
        #1-)An empty result means there is no To-Do table yet: a brand new
        #   install, with nothing to hand over
        columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(note)")}
        if not columns:
            return
        #2-)cover is only on files written while the two pages shared this table
        cover = "cover" if "cover" in columns else "''"
        connection.exec_driver_sql(
            "INSERT INTO notebook_entry (title, content, cover, created_at, updated_at) "
            f"SELECT title, content, {cover}, created_at, updated_at FROM note"
        )
        connection.commit()


def create_db_and_tables():
    '''
    1-Import models so SQLModel knows every table that needs to exist
    2-Note whether the Notebook is about to get its table for the first time
    3-Create Tables
    4-Bring older database files up to date with columns added since
    5-Hand the Notebook its copy of the notes, if this is that first time
    '''
    #1-)Importing models registers every table class with SQLModel's metadata
    import models  # noqa: F401 - its __init__ imports every model module
    #2-)Asked before create_all, since afterwards the table always exists
    notebook_is_new = not _table_exists("notebook_entry")
    #3-)Creates tables that don't exist yet (does nothing to tables that already exist)
    SQLModel.metadata.create_all(engine)
    #4-)Which is why the columns have to be handled separately
    _add_missing_columns()
    #5-)Once ever, on the file that predates the split
    if notebook_is_new:
        _copy_notes_into_notebook()


def get_session() -> Generator[Session, None, None]:
    '''
    1-Open a new Session for a single request
    2-Hand it to the route via yield
    3-Session closes automatically once the request finishes
    '''
    #1-)+2-)+3-) with-block opens the session, yields it, then closes it when the request is done
    with Session(engine) as session:
        yield session