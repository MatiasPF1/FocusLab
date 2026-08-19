"""
Canvas LMS calls. Plain functions - no FastAPI, no MCP, no LLM.

The single implementation: FastAPI routes here call it directly for the UI, and
FocusLab_MCP/server.py wraps the same functions as MCP tools for the agent.
"""

import os
import re
from pathlib import Path

import httpx
from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parents[3]          # repo root
load_dotenv(next((e for e in (_ROOT / "Client_MCP" / ".env", _ROOT / "backend" / ".env")
                  if e.exists()), _ROOT / ".env"))

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
    """Every course, newest term last. `term` is a substring match like '2026 Spring'.

    Two names come back: `name` is the section code ("2026S CS 334-A") and `title`
    is the human one ("Theory of Computation"). Canvas keeps the readable name in
    course_code, which is the reverse of what the field names suggest.
    """
    out = []
    for c in _get("/courses", **{"include[]": "term", "state[]": _STATES}):
        if c.get("access_restricted_by_date"):      # closed course -> id-only stub
            continue
        name = (c.get("term") or {}).get("name", "")
        if term and term.lower() not in name.lower():
            continue
        out.append({"id": c["id"], "name": c["name"],
                    "title": c.get("course_code"), "term": name})
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
            "title": c.get("course_code"),
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


def _file(file_id):
    """One Canvas file. `url` is pre-signed and expires, so fetch it soon after."""
    try:
        f = _get(f"/files/{file_id}")
    except httpx.HTTPStatusError:
        return None                       # file exists but this token cannot read it
    return {
        "id": f["id"],
        "name": f.get("display_name"),
        "type": f.get("content-type"),
        "kb": round((f.get("size") or 0) / 1024),
        "url": f.get("url"),
    }


def get_modules(course_id):
    """The course's module tree: every module, its items, and any file behind them.

    This is the Modules page. Items are Assignment / Page / File / ExternalUrl /
    SubHeader; only File items carry a real download, reached via content_id.
    """
    out = []
    for m in _get(f"/courses/{course_id}/modules", **{"include[]": "items"}):
        items = m.get("items")
        if items is None:                 # some modules do not inline their items
            items = _get(f"/courses/{course_id}/modules/{m['id']}/items")
        rows = []
        for it in items:
            row = {
                "type": it["type"],
                "title": it.get("title"),
                "link": it.get("html_url") or it.get("external_url"),
                "file": None,
            }
            if it["type"] == "File" and it.get("content_id"):
                row["file"] = _file(it["content_id"])
            rows.append(row)
        out.append({"module": m["name"], "items": rows})
    return out


def get_assignment_files(course_id):
    """Files and outside links attached to each assignment.

    /courses/{id}/files is 403 whenever the Files tab is hidden from students, so
    these come out of the assignment descriptions, which embed /files/{id} links.
    """
    out = []
    for a in _get(f"/courses/{course_id}/assignments"):
        html = a.get("description") or ""
        files = [f for f in (_file(i) for i in dict.fromkeys(re.findall(r"/files/(\d+)", html))) if f]
        links = sorted({
            u for u in re.findall(r'href="(https?://[^"]+)"', html)
            if "/files/" not in u                       # already covered above
        })
        if files or links:
            out.append({"assignment": a["name"], "files": files, "links": links})
    return out


if __name__ == "__main__":
    for c in get_grades("2026 Spring"):
        print(f"{c['id']:>8}  {str(c['score'] or '--'):>6}  {c['name']}")
