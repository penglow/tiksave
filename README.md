# TikSave 🚀

A mobile app that organizes your saved TikTok videos with AI-powered categorization and semantic search.

## Features

- **Smart Inbox** - Auto-sorts videos by processing status
- **AI Organization** - Automatic folder categorization
- **Semantic Search** - Find videos by meaning, not keywords
- **Batch Import** - Import up to 50 URLs at once
- **Real-time Progress** - See what's happening during processing

## Tech Stack

- **Runtime**: Bun
- **Mobile**: React Native / Expo
- **Database**: PostgreSQL + pgvector
- **Cache**: Redis
- **AI**: OpenAI + Azure Video Indexer

## Quick Start

### Prerequisites
- Bun
- Docker Desktop

### Setup

**Automatic (Windows)**
```powershell
.\start-dev.ps1
```

**Manual**
```bash
# Database
cd database && docker-compose up -d

# Backend
cd backend && bun install && bun run migrate && bun run dev

# Mobile App
cd TikSaveRN && bun install && bun start
```

## Configuration

Copy `backend/env.template` to `backend/.env` and fill values for local development:

```env
DATABASE_URL=postgresql://tiksave:tiksave_password@localhost:5432/tiksave
REDIS_URL=redis://localhost:6379
AZURE_VIDEO_INDEXER_KEY=your_key
AZURE_VIDEO_INDEXER_ACCOUNT_ID=your_id
AZURE_VIDEO_INDEXER_LOCATION=your_location
OPENAI_API_KEY=your_key
```

For production, do not use plaintext `.env` files. Store these values in Secret Manager and inject at runtime.

## Security Controls

Mandatory key management controls are implemented in `security/gcp`.

- Runtime secret handling and operational baseline: `security/gcp/README.md`
- Dormant service account key audit/decommission script: `security/gcp/audit-keys.ps1`
- API key restriction audit script: `security/gcp/audit-api-key-restrictions.ps1`
- Least-privilege IAM recommender audit script: `security/gcp/recommender-least-privilege.ps1`
- Mandatory org policy enforcement script: `security/gcp/apply-org-policies.ps1`

Run these from the repo root (PowerShell):

```powershell
.\security\gcp\audit-keys.ps1 -ProjectId "my-project"
.\security\gcp\audit-api-key-restrictions.ps1 -ProjectId "my-project"
.\security\gcp\recommender-least-privilege.ps1 -ProjectId "my-project"
.\security\gcp\apply-org-policies.ps1 -OrganizationId "123456789012" -KeyExpiryHours 720 -DisableKeyCreation
```

## Production Build

```bash
cd TikSaveRN
bunx eas build --platform ios
bunx eas build --platform android
```

---
*Built with ❤️ for better video organization.*
