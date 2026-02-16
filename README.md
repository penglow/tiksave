# TikSave

TikSave is a full-stack app for saving TikTok links, classifying them into folders, and searching them later.

## Repository Layout

- `backend/` Bun + Express API, workers, and tests
- `TikSaveRN/` Expo React Native app (iOS, Android, web)
- `database/` Docker Compose for PostgreSQL (pgvector) and Redis
- `security/gcp/` GCP security hardening scripts and guidance

## Tech Stack

- Runtime: Bun
- Backend: Express, BullMQ, PostgreSQL, Redis
- Mobile/Web Client: Expo React Native + TypeScript + Zustand
- AI/Processing: OpenAI, Azure Video Indexer, embeddings, semantic search

## Prerequisites

- Bun 1.x
- Docker Desktop

## Quick Start

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
