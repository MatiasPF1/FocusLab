"""FocusLab's own Canvas MCP server.

Thin layer over canvas.py. The value here is the docstrings: they are the only
channel an agent gets, so every default that could mislead it is stated.

Run directly for stdio (what Client_MCP/client_MCP.py spawns):
    python server.py
"""

import importlib.util
from pathlib import Path

from mcp.server.fastmcp import FastMCP

# One implementation, loaded - not copied - from the backend. Loaded by file
# path rather than as apis.canvas, because that package's __init__ builds the
# FastAPI router, and this server has no reason to install a web framework.
_CORE = Path(__file__).resolve().parents[1] / "backend" / "apis" / "canvas" / "core.py"
_spec = importlib.util.spec_from_file_location("focuslab_canvas_core", _CORE)
canvas = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(canvas)

####
#MCP Server Creation
####
mcp = FastMCP("focuslab-canvas")

#####
# Tooling 
#####


####
# 1- Find The Course
# the top of the hierarchy: a course id unlocks everything below
####

@mcp.tool()
def list_courses(term: str | None = None) -> list[dict]:
    """List courses with their id, both names, and term.

    RESOLVING A COURSE NAME: each course carries two, and Canvas stores them the
    opposite way round to what the field names imply -
        name  = section code,   "2026S CS 334-A"   (from Canvas `name`)
        title = readable title, "Theory of Computation" (from Canvas `course_code`)
    Match user wording against BOTH, case-insensitively, on substrings. People say
    the title or a fragment ("334", "theory of comp"), almost never the exact code.
    Call this before any tool that takes a course_id; ids must come from here.

    Includes finished and unpublished terms, so next semester's courses appear
    here before an instructor publishes them.

    Args:
        term: substring match on the term name, e.g. "2026 Spring". Omit for all.
    """
    return canvas.list_courses(term)


####
# 2- Course Structure
# two views of one course: by topic (modules) and by due date (assignments)
####

@mcp.tool()
def get_modules(course_id: int) -> list[dict]:
    """The course's module tree - START HERE for any "where is X" question.

    Modules are the spine of a Canvas course and hold essentially all of its
    material in teaching order: lecture notes and slides, homework, solution
    keys, readings, and outside links. If the question is about finding, reading
    or listing course content rather than about grades, this is the right tool.

    Returns modules in order, each with its items. Items are a FLAT ordered
    list, not nested: `indent` carries the structure the Canvas web page shows.
    indent=0 is top level; an indent=1 item belongs to the indent=0 item above
    it, so a File at indent=1 under "Homework 1" is that homework's attachment.

    Item `type` is one of:
      Page        lecture notes and written content   (read via `link`)
      Assignment  homework, attendance, projects      (`link` opens it)
      File        a real download - PDFs, slides, solution keys
      ExternalUrl an outside link
    Only File items carry a `file` object (name, type, size, download url);
    every other type is None there and is reached through `link`.

    Solution keys usually appear ONLY here as File items, not on the assignment
    itself, so a question about solutions needs this tool rather than
    get_assignment_files.

    Args:
        course_id: Canvas course id from list_courses, e.g. 85395.
    """
    return canvas.get_modules(course_id)


@mcp.tool()
def get_assignments(course_id: int) -> list[dict]:
    """The Assignments page: every assignment bucketed by due date.

    The other view of a course structure, alongside get_modules. Modules group
    by topic and hold the material; this groups by time - Upcoming, Undated,
    Past - and is the right tool for "what is due", "what is left", or any
    question about the shape of the workload rather than where a file lives.

    Undated is not empty filler: a course's rolled-up marks ("Homework average",
    "Overall grade") live there with no due date.

    Each assignment also carries `group`, the weighted category it counts toward
    ("Homework", "Exams", "Attendance"). That is what drives the final grade, so
    it explains why one assignment matters more than another.

    Args:
        course_id: Canvas course id from list_courses, e.g. 85395.
    """
    return canvas.get_assignments(course_id)

####
# 3- Content Inside A Module Item
# the files hanging off a Page or an Assignment
####

@mcp.tool()
def get_page_files(course_id: int, page: str | None = None) -> list[dict]:
    """Files linked inside module Pages - this is where lecture slides live.

    get_modules shows a lecture as a Page with file=None, because the slide PDFs
    are links in the page body rather than module items. Use this whenever the
    question is about lecture slides or notes; get_modules on its own makes the
    lectures look like they have no files at all.

    Each hit gives the module, the page title, and files carrying an `id` - those
    ids are what download_files takes.

    A lecture usually publishes three variants of one deck:
      *.short.pdf    handout, no worked solutions
      *.pdf          full slides with sample solutions
      *.marked.pdf   full slides plus notes written during class
    If the user did not say which, ask rather than silently taking all three.

    Args:
        course_id: Canvas course id from list_courses, e.g. 85395.
        page: plain substring on the page title. "Lecture 1" also matches
            Lecture 10-19, so use "Lecture 1:" to pin one. Omit to sweep the
            whole course, which takes around 30 seconds.
    """
    return canvas.get_page_files(course_id, page)


@mcp.tool()
def get_assignment_files(course_id: int) -> list[dict]:
    """
    Files and outside links attached to each assignment in a course.

    The handout for a homework - the PDF with the actual questions - plus any
    starter files and links the instructor referenced.

    Use get_modules instead when looking for lecture notes or solution keys;
    those live in modules, not on the assignment.

    Args:
        course_id: Canvas course id from list_courses, e.g. 85395.
    """
    return canvas.get_assignment_files(course_id)


####
# 4- Pull Content Onto Disk
# the leaf action: ids gathered above become real files
####

@mcp.tool()
def download_files(file_ids: list[int], folder: str) -> list[dict]:
    """
    Save Canvas files onto the user's computer, under ~/Downloads/<folder>.

    This writes real files to disk, so call it only when the user actually asked
    to download or save something. Ids must come from get_page_files,
    get_modules or get_assignment_files; a guessed id fetches the wrong file.

    `folder` is one bare name, not a path: "334" means ~/Downloads/334.
    Returns the name, size and full path of everything written.

    Args:
        file_ids: Canvas file ids to fetch.
        folder: subfolder name under Downloads, e.g. "334".
    """
    return canvas.download(file_ids, folder)


####
# 5- Grades
# a separate axis - nothing here needs the module tree
####

@mcp.tool()
def get_grades(term: str | None = None) -> list[dict]:
    """Current score and letter grade per course, with both course names.

    Scores are grade-to-date: ungraded work is NOT counted as zero, so an early
    semester percentage is not predictive. A score of None means nothing has been
    graded yet, which is not the same as a zero.

    Args:
        term: substring match on the term name, e.g. "2026 Spring". Omit for all.
    """
    return canvas.get_grades(term)


@mcp.tool()
def get_assignment_grades(course_id: int, graded_only: bool = False) -> list[dict]:
    """Every assignment in one course with my score, points possible and due date.

    Needs a course_id from list_courses or get_grades, never a course name and
    never a guessed number.

    Args:
        course_id: Canvas course id from list_courses, e.g. 85395.
        graded_only: drop assignments with no score yet.
    """
    return canvas.get_assignment_grades(course_id, graded_only)


@mcp.tool()
def get_unsubmitted(course_id: int) -> list[dict]:
    """Assignments in one course that have not been turned in.

    Unsubmitted is not the same as overdue: this includes work not yet due. An
    empty list means nothing is outstanding, not that the lookup failed.

    Args:
        course_id: Canvas course id from list_courses, e.g. 85395.
    """
    return canvas.get_unsubmitted(course_id)

if __name__ == "__main__":
    mcp.run()
