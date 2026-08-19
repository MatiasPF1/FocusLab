'''
Canvas routing resources - GET only.

Every route here only reads from Canvas. Nothing in this file writes back to
Canvas or to our own database.

The Canvas calls themselves live in apis/canvas/core.py, which is deliberately
free of FastAPI so the MCP server can import the same functions.
'''

import httpx
from fastapi import HTTPException, Query

from apis.canvas import core
from apis.canvas.router import router


##########
# Routed Resources
##########

'''
/canvas/tasks --> (Assignments due in a one week window, plus a done/total count)
'''


##########
# Routes
##########

@router.get("/tasks")
def get_tasks(
    start: str | None = Query(None, description="YYYY-MM-DD, first day of the window. Defaults to today."),
    days: int = Query(7, ge=1, le=31),
):
    '''
    1-Ask Canvas for the assignments due inside the window
    2-Turn a Canvas failure into a real status code instead of a 500
    '''
    #1-)core does the scanning; this route only carries the arguments across
    try:
        return core.get_tasks(start, days)
    #2-)A bad or expired Canvas token reads as 401 here, not as a server crash
    except httpx.HTTPStatusError as failure:
        raise HTTPException(
            status_code=failure.response.status_code,
            detail="Canvas rejected the request. Check CANVAS_TOKEN.",
        )
    #3-)No Canvas credentials at all: this route is off, the rest of the API is not
    except RuntimeError as missing:
        raise HTTPException(status_code=503, detail=str(missing))
