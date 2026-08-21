'''
Every table this backend stores, one module per service.

The module names mirror the packages under apis/, so apis/todo/ and
models/todo.py are obviously a pair.

Importing this package imports every module below, which is what
registers their table classes with SQLModel's metadata. create_db_and_tables()
in database.py relies on exactly that: one import, every table known.
'''

from models import queues, spotify, todo, notebook, keys  # noqa: F401 - registers the tables
