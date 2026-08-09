# FocusLab — Architecture

Current state of the application: how the pieces run, how they talk to each
other, and where data lives.

## High-level overview

```
                                   ┌──────────────────────────┐
                                   │          Browser          │
                                   │      (localhost:3000)     │
                                   └─────────────┬──────────────┘
                                                  │
                                                  │ HTTP
                                                  ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │                              Docker Compose                            │
   │                                                                        │
   │   ┌─────────────────────────┐          ┌─────────────────────────┐     │
   │   │        frontend          │          │         backend          │   │
   │   │  Next.js 16 + TypeScript │  HTTP    │  FastAPI (Python)        │   │
   │   │  Tailwind CSS            │─────────▶│  uvicorn --reload        │   │
   │   │  container port: 3000    │          │  container port: 8000    │   │
   │   └─────────────────────────┘          └─────────────--┬────────────┘  | 
   │                                                        │               │
   └────────────────────────────────────────────────────────┼───────────────┘
                                                              │
                                        ┌─────────────────────┼─────────────────────┐
                                        │                                           │
                                        ▼                                           ▼
                          ┌──────────────────────────┐            ┌──────────────────────────┐
                          │        SQLite DB          │            │       Spotify Web API      │
                          │  ./database/focuslab.db   │            │  accounts.spotify.com      │
                          │  (Docker volume, persists │            │  api.spotify.com           │
                          │   across rebuilds)         │            │  OAuth 2.0 login + control │
                          └──────────────────────────┘            └──────────────────────────┘
```
