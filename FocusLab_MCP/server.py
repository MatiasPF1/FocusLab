"""FocusLab's own Canvas MCP server.

Thin layer over canvas.py. The value here is the docstrings: they are the only
channel an agent gets, so every default that could mislead it is stated.

Run directly for stdio (what Client_MCP/client_MCP.py spawns):
    python server.py
"""

import sys
from pathlib import Path

from mcp.server.fastmcp import FastMCP

# one implementation, imported - not copied - from the backend
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from apis.canvas import core as canvas

####
#MCP Server Creation
####
mcp = FastMCP("focuslab-canvas")

#####
# Tooling 
#####


####
# 1- Getting Data From Courses Tools
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


@mcp.tool()
def get_modules(course_id: int) -> list[dict]:
    """The course's module tree - START HERE for any "where is X" question.

    Modules are the spine of a Canvas course and hold essentially all of its
    material in teaching order: lecture notes and slides, homework, solution
    keys, readings, and outside links. If the question is about finding, reading
    or listing course content rather than about grades, this is the right tool.

    Returns modules in order, each with its items. Item `type` is one of:
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
def get_assignment_files(course_id: int) -> list[dict]:
    """Files and outside links attached to each assignment in a course.

    The handout for a homework - the PDF with the actual questions - plus any
    starter files and links the instructor referenced.

    Use get_modules instead when looking for lecture notes or solution keys;
    those live in modules, not on the assignment.

    Args:
        course_id: Canvas course id from list_courses, e.g. 85395.
    """
    return canvas.get_assignment_files(course_id)


if __name__ == "__main__":
    mcp.run()
