# Backend Quick Start

This guide starts the API in development mode.

## Prerequisites

- Bun 1.x
- Docker Desktop
- Running PostgreSQL + Redis from `database/docker-compose.yml`

## 1) Configure environment

From `backend/`:

```powershell
copy env.template .env
```

Minimum required local values:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`

Optional integrations (used by specific flows):

- `OPENAI_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_VIDEO_INDEXER_ACCOUNT_ID`
- Azure subscription/resource settings in `env.template`

## 2) Install dependencies

```powershell
bun install
```

## 3) Run migrations

```powershell
bun run migrate
```

## 4) Start server

```powershell
bun run dev
```

Server defaults to `http://localhost:3000`.

## Verification

Check health endpoint:

- `GET http://localhost:3000/health`

Expected result is JSON with `status` and dependency checks (`db`, `redis`, `openai`).

## Useful scripts

- `bun run build` - build to `dist/`
- `bun run start` - run built server
- `bun run seed` - seed sample data
- `bun run test` - run backend tests
- `bun run test:watch` - watch mode tests
- `bun run test:coverage` - coverage report

## Troubleshooting

- Port in use: set `PORT` in `.env`.
- DB errors: ensure containers are up (`cd ..\database && docker-compose up -d`).
- Auth errors on startup/runtime: verify `JWT_SECRET` is set.

For full setup details, see `backend/START-BACKEND.md`.