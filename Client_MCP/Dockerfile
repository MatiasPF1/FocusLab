# Built from the repo root, not from this folder: the agent spawns
# FocusLab_MCP/server.py, and that server loads the backend's Canvas core by
# file path. All three have to keep their relative positions inside the image,
# so the layout under /app mirrors the repo.
FROM python:3.12-slim

WORKDIR /app

# Requirements first, and both files, because Client_MCP/requirements.txt
# includes the MCP server's with a relative -r.
COPY Client_MCP/requirements.txt Client_MCP/requirements.txt
COPY FocusLab_MCP/requirements.txt FocusLab_MCP/requirements.txt

RUN pip install --no-cache-dir -r Client_MCP/requirements.txt

COPY Client_MCP/ Client_MCP/
COPY FocusLab_MCP/ FocusLab_MCP/
# Only the Canvas package: server.py reads apis/canvas/core.py off disk.
COPY backend/apis/canvas/ backend/apis/canvas/

WORKDIR /app/Client_MCP

EXPOSE 8001

CMD ["uvicorn", "http_MCP:app", "--host", "0.0.0.0", "--port", "8001"]
