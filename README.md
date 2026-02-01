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
- Node.js
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

Create `backend/.env`:

```env
DATABASE_URL=postgresql://tiksave:tiksave_password@localhost:5432/tiksave
REDIS_URL=redis://localhost:6379
AZURE_VIDEO_INDEXER_KEY=your_key
AZURE_VIDEO_INDEXER_ACCOUNT_ID=your_id
AZURE_VIDEO_INDEXER_LOCATION=your_location
OPENAI_API_KEY=your_key
```

## Production Build

```bash
cd TikSaveRN
bunx eas build --platform ios
bunx eas build --platform android
```

---
*Built with ❤️ for better video organization.*
