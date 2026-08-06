# 🎯 FocusLab


A centralized platform for productivity and organization to help you stay focused, created by students, for students.

## About

FocusLab is a modern web application designed to help students manage their academic life more effectively. Our goal is to provide tools that enhance focus, organization, and productivity in a single, intuitive platform.

## Features (Coming Soon)

- 📚 Task & assignment management
- ⏱️ Focus timer / Pomodoro technique
- 📅 Study schedule planner
- 📊 Progress tracking
- 🎯 Goal setting
- 🎵 Spotify-connected focus queues — save your own ordered playlists ("Deep Focus", "Study Break", ...) and start them playing on Spotify right from FocusLab

## Tech Stack

**Frontend**
- **Framework:** Next.js 16
- **Language:** TypeScript
- **Styling:** Tailwind CSS

**Backend**
- **Framework:** FastAPI (Python)
- **Database:** SQLite via SQLModel
- **HTTP client:** httpx (used for Spotify's OAuth + Web API calls)
- **Integration:** Spotify Web API (OAuth 2.0 login, playback control)

**Infra**
- Docker & Docker Compose (one command spins up frontend + backend together)

## Project Structure

```
FocusLab/
├── frontend/   # Next.js app (UI, API routes)
└── backend/    # FastAPI server (Spotify OAuth, queues, database)
```

## Getting Started

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

```bash
# From the FocusLab root folder

# 1. Build the images (first run only — downloads Node/Python and installs deps)
docker compose build --progress=plain

# 2. Start both services
docker compose up
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:8000](http://localhost:8000)

Subsequent runs only need `docker compose up` (add `--build` if dependencies changed).

Stop the stack with `Ctrl + C`, or `docker compose down` to remove the containers.

## Contributing

This project is currently in early development. Stay tuned for updates!

## License

MIT


