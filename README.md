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

## Tech Stack

- **Framework:** Next.js 16
- **Language:** TypeScript
- **Styling:** Tailwind CSS

## Project Structure

```
FocusLab/
├── frontend/   # Next.js app (UI, API routes, database logic)
└── backend/    # Reserved for a dedicated backend server 
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


