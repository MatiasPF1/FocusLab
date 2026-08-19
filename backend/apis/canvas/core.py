"""
Canvas LMS calls. Plain functions - no FastAPI, no MCP, no LLM.

The single implementation: FastAPI routes here call it directly for the UI, and
FocusLab_MCP/server.py wraps the same functions as MCP tools for the agent.
"""

import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv

_BACKEND = Path(__file__).resolve().parents[2]       # backend/, the only path the container has
_ROOT = _BACKEND.parent                              # repo root, present when run from a checkout
load_dotenv(next((e for e in (_ROOT / "Client_MCP" / ".env", _BACKEND / ".env")
                  if e.exists()), _BACKEND / ".env"))

_client = None


def _canvas():
    """The Canvas http client, built on first use rather than on import.

    main.py imports this package to mount the routes, so building the client at
    import time meant an unset CANVAS_TOKEN stopped the whole API from starting
    - Spotify included - instead of only failing the Canvas routes.
    """
    global _client
    if _client is None:
        try:
            base, token = os.environ["CANVAS_URL"], os.environ["CANVAS_TOKEN"]
        except KeyError as missing:
            raise RuntimeError(f"Canvas is not configured: {missing} is unset") from None
        _client = httpx.Client(
            base_url=f"{base}/api/v1",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
    return _client

# Canvas hides unpublished courses unless asked, and unpublished is where next
# semester lives. Always send all three states.
_STATES = ["unpublished", "available", "completed"]

DOWNLOADS = Path.home() / "Downloads"


def _get(path, **params):
    reply = _canvas().get(path, params={"per_page": 100, **params})   # default page size is 10
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


def get_assignments(course_id):
    """Every assignment, grouped the way the Canvas Assignments page groups them.

    That page buckets by due date rather than by module - Upcoming / Undated /
    Past - so it is the other view of a course, next to get_modules. `group` is
    the weighted category the assignment counts toward ("Homework", "Exams"),
    which is what actually drives the final grade.
    """
    groups = {g["id"]: g["name"] for g in _get(f"/courses/{course_id}/assignment_groups")}
    now = datetime.now(timezone.utc)
    buckets = {"Upcoming": [], "Undated": [], "Past": []}
    for a in _get(f"/courses/{course_id}/assignments", **{"include[]": "submission"}):
        due = a.get("due_at")
        if not due:
            when = "Undated"
        else:
            when = "Upcoming" if datetime.fromisoformat(due) >= now else "Past"
        s = a.get("submission") or {}
        buckets[when].append({
            "name": a["name"],
            "group": groups.get(a.get("assignment_group_id")),
            "due": (due or "")[:10] or None,
            "score": s.get("score"),
            "possible": a.get("points_possible"),
            "state": s.get("workflow_state"),
        })
    return [{"bucket": b, "assignments": v} for b, v in buckets.items() if v]

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


def get_tasks(start=None, days=7):
    """Assignments due inside a window, for the tasks panel in the UI.

    Scans only courses whose term overlaps the window, so this costs a handful
    of calls rather than one per course in the account. Courses on a term with
    no dates at all are sandboxes, not a semester, and are skipped.

    `done` counts anything submitted or graded, which is what the ring shows.
    """
    begin = date.fromisoformat(start) if start else date.today()
    finish = begin + timedelta(days=days)
    lo, hi = begin.isoformat(), finish.isoformat()

    courses = []
    for c in _get("/courses", **{"include[]": ["term", "teachers"], "state[]": _STATES}):
        if c.get("access_restricted_by_date"):
            continue
        t = c.get("term") or {}
        t_start, t_end = (t.get("start_at") or "")[:10], (t.get("end_at") or "")[:10]
        if not t_start and not t_end:
            continue
        if (t_start and t_start > hi) or (t_end and t_end < lo):
            continue
        courses.append(c)

    colors = _get("/users/self/colors").get("custom_colors", {})
    tasks = []
    for c in courses:
        try:
            items = _get(f"/courses/{c['id']}/assignments", **{"include[]": "submission"})
        except httpx.HTTPStatusError:
            continue                     # course is listed but its assignments are not readable
        teachers = [t.get("display_name") for t in (c.get("teachers") or []) if t.get("display_name")]
        for a in items:
            due = a.get("due_at") or ""
            if not (lo <= due[:10] < hi):
                continue
            s = a.get("submission") or {}
            tasks.append({
                "id": a["id"],
                "course": c.get("course_code"),          # the readable name, see list_courses
                "course_id": c["id"],
                "teacher": teachers[0].split()[-1] if teachers else None,   # surname, as Canvas shows it
                "color": colors.get(f"course_{c['id']}"),
                "title": a["name"],
                "due": due,
                "points": a.get("points_possible"),
                "done": s.get("workflow_state") in ("submitted", "graded"),
                "link": a.get("html_url"),
            })

    tasks.sort(key=lambda t: t["due"])
    return {
        "start": lo,
        "end": hi,
        "done": sum(1 for t in tasks if t["done"]),
        "total": len(tasks),
        "tasks": tasks,
    }

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

    Canvas stores items as one flat ordered list, not a tree: nesting lives in
    `indent`, which is what the web UI renders as indentation. indent=1 under an
    indent=0 assignment is that assignment's attachment, so it is kept.
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
                "indent": it.get("indent", 0),      # 0 = top level, 1 = under the item above
                # ExternalUrl always carries an html_url too, but it is only a
                # module_item_redirect stub - the real destination is external_url
                "link": it.get("external_url") or it.get("html_url"),
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


def _safe(name):
    """A bare filename: no separators, no traversal, no drive letter."""
    name = re.sub(r"[^\w.\- ]", "_", Path(str(name)).name).strip(". ")
    return name or "untitled"


def get_page_files(course_id, page=None):
    """Files embedded in each module Page - where lecture slides actually live.

    A Page item in get_modules has file=None: its PDFs are links inside the page
    body, so every page has to be fetched and scraped the way assignments are.
    `page` is a substring match on the page title ("Lecture 1"), and it skips the
    fetch, so narrowing turns a ~30s sweep of the course into about a second.
    """
    out = []
    for m in _get(f"/courses/{course_id}/modules", **{"include[]": "items"}):
        items = m.get("items")
        if items is None:
            items = _get(f"/courses/{course_id}/modules/{m['id']}/items")
        for it in items:
            if it["type"] != "Page" or not it.get("page_url"):
                continue
            if page and page.lower() not in (it.get("title") or "").lower():
                continue
            body = _get(f"/courses/{course_id}/pages/{it['page_url']}").get("body") or ""
            ids = dict.fromkeys(re.findall(r"/files/(\d+)", body))     # dedupe, keep order
            files = [f for f in (_file(i) for i in ids) if f]
            if files:
                out.append({"module": m["name"], "page": it["title"], "files": files})
    return out


def download(file_ids, folder):
    """Save Canvas files into ~/Downloads/<folder>. Returns what landed on disk.

    Folder and filenames come from Canvas or a caller, so both go through _safe:
    nothing written here may escape Downloads. The file url is already
    pre-signed, so it is fetched without our token attached.
    """
    dest = DOWNLOADS / _safe(folder)
    dest.mkdir(parents=True, exist_ok=True)
    out = []
    for fid in file_ids:
        f = _file(fid)
        if not f or not f.get("url"):
            out.append({"id": fid, "error": "no readable file"})
            continue
        path = dest / _safe(f["name"] or f"canvas-{fid}")
        with httpx.stream("GET", f["url"], follow_redirects=True, timeout=60) as r:
            r.raise_for_status()
            with open(path, "wb") as fh:
                for chunk in r.iter_bytes():
                    fh.write(chunk)
        out.append({"name": path.name, "kb": round(path.stat().st_size / 1024),
                    "path": str(path)})
    return out

if __name__ == "__main__":
    for c in get_grades("2026 Spring"):
        print(f"{c['id']:>8}  {str(c['score'] or '--'):>6}  {c['name']}")
