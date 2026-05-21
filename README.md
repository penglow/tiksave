# TikSave

TikSave is a personal library for TikTok videos you want to keep. Instead of losing links in your camera roll, DMs, or an endless “Saved” list, you paste or share a URL and TikSave does the organizing work for you.

## What It Does

When you save a TikTok link, the backend fetches metadata (title, thumbnail, creator, hashtags) and runs AI analysis on the content—topics, labels, transcript-style text, and optional deeper video indexing when Azure is configured. Each item is **automatically classified** into folders based on what the video is about, with confidence scores and alternatives you can override. You can also import in **batch**, move items between folders, and watch **live processing progress** while a video is queued and analyzed.

On the client (Expo for **iOS, Android, and web**), you get:

- **Library** — browse saved videos by folder and category
- **Import** — paste URLs, use clipboard detection, or share from TikTok via the native share extension
- **Search** — keyword and **semantic search** (embeddings in PostgreSQL/pgvector) so queries like “chicken recipes” or “Tokyo travel” match intent, not just exact words
- **Map** — videos with detected locations appear on a map (Google Maps on supported platforms)
- **Settings** — account and app preferences behind JWT auth

The stack is built for real use: Bun + Express API, BullMQ workers for async processing, Redis for queues/cache, and a React Native app with Zustand for state. Learning from your folder choices improves future classification over time.

## Repository Layout

- `backend/` Bun + Express API, workers, and tests
- `TikSaveRN/` Expo React Native app (iOS, Android, web)
- `database/` Docker Compose for PostgreSQL (pgvector) and Redis
- `security/gcp/` GCP security hardening scripts and guidance
- `docs/STYLE_GUIDE.md` coding conventions (imports, layout, naming)

## Code Style

From `TikSaveRN/`:

```powershell
bun run format      # Prettier
bun run lint        # ESLint (src only)
bun run typecheck   # TypeScript
```

See [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) for project conventions.

After pulling style-guide changes, restart Expo with a clean cache if modules fail to resolve: `bunx expo start -c`.

## Tech Stack

- Runtime: Bun
- Backend: Express, BullMQ, PostgreSQL, Redis
- Mobile/Web Client: Expo React Native + TypeScript + Zustand
- AI/Processing: OpenAI, Azure Video Indexer, embeddings, semantic search

## Prerequisites

- Bun 1.x
- Docker Desktop

## Quick Start

### Docker full stack

From the repository root:

```powershell
docker compose up --build
```

- Frontend: `http://localhost:8081`
- Backend health check: `http://localhost:3000/health`
- API base URL used by the web app: `http://localhost:3000/api`

Optional local secrets can be provided in a root `.env` file using the same names as `backend/env.template` (`OPENAI_API_KEY`, `GOOGLE_MAPS_API_KEY`, Azure values, and so on). The web map also accepts `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. If `database/docker-compose.yml` is already running, stop it first or override `POSTGRES_PORT`, `REDIS_PORT`, and `BACKEND_PORT` to avoid port conflicts.

### Manual development

### 1) Start infrastructure

```powershell
cd database
docker-compose up -d
```

### 2) Configure backend env

```powershell
cd ..\backend
copy env.template .env
```

Set local values in `backend/.env` (at minimum: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`).

### 3) Run backend

```powershell
cd backend
bun install
bun run migrate
bun run dev
```

API health check: `http://localhost:3000/health`

### 4) Run app

```powershell
cd TikSaveRN
bun install
bun run start
```

For web-only development:

```powershell
bun run web
```

## Windows Helper Script

`start-dev.ps1` starts backend + frontend in separate PowerShell windows.

```powershell
.\start-dev.ps1
```

Note: it does not start Docker services. Start `database/docker-compose.yml` first.

## Security

Production secrets should come from a secret manager, not checked-in `.env` files.

GCP key management controls and scripts are documented in `security/gcp/README.md`.

---
*Built with ❤️ for better video organization.*
