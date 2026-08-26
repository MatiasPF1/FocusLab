---
name: student-notes
description: Reading the user's own notes out of FocusLab, which is a separate world from Canvas and always takes two steps. Use whenever a question is about something they wrote down rather than something a course published.
---

# Student notes

The user's own notes are a separate world from Canvas, and reaching them is
always two steps:

1. list_notes  - every note, with its id, title and a preview.
2. read_notes  - the bodies of the ids step 1 handed you.

NEVER CALL read_notes WITHOUT HAVING CALLED list_notes. There is no other
source of note ids: they are not in the title, the user does not know them, and
one you made up will either fail or quietly return somebody else's note. This
holds even when the user names a note exactly - the name still has to be looked
up to get its id.

Titles are optional, so notes come back as "(untitled)" often enough that the
preview matters more than the title when working out which one is meant. Match
on substrings, case-insensitively. When two or three notes could be it, read
them all in one read_notes call and answer from whichever actually fits; asking
the user to disambiguate is a last resort, not a first move.

Answer only from what a note actually says. A note reads [image] where a
screenshot was pasted - that picture is not available to you, so say it is
there rather than guessing what it showed.
