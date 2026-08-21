# Built from the repo root, not from this folder: the agent spawns
# FocusLab_MCP/server.py, and that server loads the backend's Canvas core by
# file path. All three have to keep their relative positions inside the image,
# so the layout under /app mirrors the repo.
FROM python:3.12-slim

WORKDIR /app

##########
# LaTeX
##########

# pdf.py shells out to this to turn the Notebook's converted pages into PDFs.
#
# Tectonic rather than TeX Live: one static binary and the ~50 MB of packages
# warmed below, against a couple of gigabytes of apt. It pulls what a document
# needs out of its bundle on first use and caches it, which is exactly what the
# warm-up compile is for - it does that fetching now, at build time, so the
# first page a user converts does not sit waiting on a download, and a machine
# that happens to be offline still renders the preamble we ask Claude for.
ARG TECTONIC_VERSION=0.17.0

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates; \
    rm -rf /var/lib/apt/lists/*; \
    curl -fsSL -o /tmp/tectonic.tar.gz \
      "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz"; \
    mkdir -p /tmp/tectonic; \
    tar -xzf /tmp/tectonic.tar.gz -C /tmp/tectonic; \
    find /tmp/tectonic -type f -name tectonic -exec mv {} /usr/local/bin/tectonic \;; \
    chmod +x /usr/local/bin/tectonic; \
    rm -rf /tmp/tectonic /tmp/tectonic.tar.gz; \
    tectonic --version

# The preamble latex.py asks Claude for, compiled once so every package, font
# and format file it needs is in the image's cache rather than fetched later.
COPY Client_MCP/warm.tex /tmp/warm/warm.tex
RUN tectonic -X compile --untrusted --outfmt pdf /tmp/warm/warm.tex && rm -rf /tmp/warm

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
