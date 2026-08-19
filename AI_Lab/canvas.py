"""Canvas LMS calls. Plain functions - no MCP, no LLM.

FocusLab's UI calls these directly; server.py exposes the same functions as MCP
tools. One implementation, two callers.
"""

import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

_canvas = httpx.Client(
    base_url=f"{os.environ['CANVAS_URL']}/api/v1",
    headers={"Authorization": f"Bearer {os.environ['CANVAS_TOKEN']}"},
    timeout=30,
)

# Canvas hides unpublished courses unless asked, and unpublished is where next
# semester lives. Always send all three states.
_STATES = ["unpublished", "available", "completed"]


def _get(path, **params):
    reply = _canvas.get(path, params={"per_page": 100, **params})   # default page size is 10
    reply.raise_for_status()
    return reply.json()


def list_courses(term=None):
    """Every course, newest term last. `term` is a substring match like '2026 Spring'."""
    out = []
    for c in _get("/courses", **{"include[]": "term", "state[]": _STATES}):
        if c.get("access_restricted_by_date"):      # closed course -> id-only stub
            continue
        name = (c.get("term") or {}).get("name", "")
        if term and term.lower() not in name.lower():
            continue
        out.append({"id": c["id"], "name": c["name"], "term": name})
    return out


def get_grades(term=None):
    """Current score per course. Grade-to-date: ungraded work is not counted as zero."""
    out = []
    for c in _get("/courses", **{"include[]": ["term", "total_scores"], "state[]": _STATES}):
        if c.get("access_restricted_by_date"):
            continue
        tname = (c.get("term") or {}).get("name", "")
        if term and term.lower() not in tname.lower():
            continue
        e = (c.get("enrollments") or [{}])[0]
        out.append({
            "id": c["id"],
            "name": c["name"],
            "term": tname,
            "score": e.get("computed_current_score"),
            "letter": e.get("computed_current_grade"),
        })
    return out


def get_assignment_grades(course_id, graded_only=False):
    """Every assignment in one course with my score."""
    out = []
    for a in _get(f"/courses/{course_id}/assignments", **{"include[]": "submission"}):
        s = a.get("submission") or {}
        if graded_only and s.get("score") is None:
            continue
        out.append({
            "name": a["name"],
            "score": s.get("score"),
            "possible": a.get("points_possible"),
            "state": s.get("workflow_state"),
            "due": (a.get("due_at") or "")[:10] or None,
        })
    return out


def get_unsubmitted(course_id):
    """Assignments not turned in. Canvas filters this server-side via bucket."""
    return [
        {"name": a["name"], "possible": a.get("points_possible"),
         "due": (a.get("due_at") or "")[:10] or None}
        for a in _get(f"/courses/{course_id}/assignments",
                      bucket="unsubmitted", **{"include[]": "submission"})
    ]


if __name__ == "__main__":
    for c in get_grades("2026 Spring"):
        print(f"{c['id']:>8}  {str(c['score'] or '--'):>6}  {c['name']}")
