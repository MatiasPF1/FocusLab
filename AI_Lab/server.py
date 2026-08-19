"""FocusLab's own Canvas MCP server.

Thin layer over canvas.py. The value here is the docstrings: they are the only
channel an agent gets, so every default that could mislead it is stated.

Run directly for stdio (what client.py uses):
    python server.py
"""

from mcp.server.fastmcp import FastMCP

import canvas

mcp = FastMCP("focuslab-canvas")


@mcp.tool()
def list_courses(term: str | None = None) -> list[dict]:
    """List courses with their id and term.

    Includes finished and unpublished terms, so next semester's courses appear
    here before an instructor publishes them.

    Args:
        term: substring match on the term name, e.g. "2026 Spring". Omit for all.
    """
    return canvas.list_courses(term)


@mcp.tool()
def get_grades(term: str | None = None) -> list[dict]:
    """Current score and letter grade per course.

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

    Needs a course_id from list_courses or get_grades, not a course name.

    Args:
        course_id: Canvas course id, e.g. 85395.
        graded_only: drop assignments with no score yet.
    """
    return canvas.get_assignment_grades(course_id, graded_only)


@mcp.tool()
def get_unsubmitted(course_id: int) -> list[dict]:
    """Assignments in one course that have not been turned in.

    Unsubmitted is not the same as overdue: this includes work not yet due.

    Args:
        course_id: Canvas course id, e.g. 85395.
    """
    return canvas.get_unsubmitted(course_id)


if __name__ == "__main__":
    mcp.run()
