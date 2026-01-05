# TikTok Organizer (TikSave)

A smart iOS app that transforms your saved TikTok videos into an organized, searchable library with AI-powered categorization.

## Project Structure

```
├── TikSave/                    # iOS App (SwiftUI)
│   ├── App/                    # App entry point
│   ├── Models/                 # Data models
│   ├── Views/                  # SwiftUI views
│   ├── ViewModels/             # View models
│   ├── Services/               # API & local services
│   └── Resources/              # Assets, configs
│
├── TikSaveExtension/           # Share Extension
│   └── ShareViewController.swift
│
├── backend/                    # Node.js API Server
│   ├── src/
│   │   ├── routes/             # API endpoints
│   │   ├── services/           # Business logic
│   │   ├── models/             # Database models
│   │   ├── workers/            # Job queue workers
│   │   └── utils/              # Utilities
│   └── package.json
│
└── database/                   # Database schemas
    └── migrations/
```

## Features

- **Share Extension**: Instantly save TikToks with one tap from the share sheet
- **AI Categorization**: Automatically files videos into the right folders
- **Smart Search**: Find videos by meaning, not just keywords
- **Learning System**: Gets smarter from your corrections

## Tech Stack

### iOS App
- Swift 5.9+
- SwiftUI
- Core Data (local cache)
- App Groups (share extension communication)

### Backend
- Node.js + Express
- PostgreSQL with pgvector (for embeddings)
- Redis (job queue)
- Azure AI Video Indexer

## Setup Instructions

### iOS App
1. Open `TikSave.xcodeproj` in Xcode 15+
2. Update bundle identifier and App Group ID
3. Configure API base URL in `Config.swift`
4. Build and run

### Backend
1. `cd backend && npm install`
2. Copy `.env.example` to `.env` and configure
3. Run migrations: `npm run migrate`
4. Start server: `npm run dev`

## API Keys Required
- Azure Video Indexer account
- OpenAI API key (for embeddings)

