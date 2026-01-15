# TikSave

A smart mobile app that transforms your saved TikTok videos into an organized, searchable library with AI-powered categorization. Built with React Native and Expo.

## Features

- **📥 Smart Inbox** - Incoming videos categorized by status (processing, needs review, recently filed)
- **📁 Folder Organization** - Hierarchical folder structure with custom icons
- **🔍 Smart Search** - Semantic and keyword search powered by AI
- **🤖 AI Categorization** - Automatic folder suggestions based on video content
- **🎨 Beautiful Dark UI** - Modern, sleek interface with gradient accents

## Project Structure

```
├── TikSaveRN/                  # Mobile App (React Native + Expo)
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   ├── config/             # App configuration & theme
│   │   ├── navigation/         # React Navigation setup
│   │   ├── screens/            # App screens
│   │   ├── services/           # API services
│   │   ├── stores/             # Zustand state management
│   │   ├── types/              # TypeScript types
│   │   └── utils/              # Utility functions
│   ├── App.tsx                 # Entry point
│   └── package.json
│
├── backend/                    # Node.js API Server
│   ├── src/
│   │   ├── database/           # Database init, migrations, seeds
│   │   ├── middleware/         # Auth & error handling
│   │   ├── routes/             # API endpoints
│   │   ├── services/           # Business logic
│   │   ├── workers/            # Job queue workers
│   │   └── utils/              # Shared utilities
│   └── package.json
│
└── database/                   # Docker & SQL init scripts
```

## Tech Stack

### Mobile App
- React Native with Expo SDK 51
- TypeScript
- React Navigation (bottom tabs + stack)
- Zustand for state management
- Expo Secure Store for auth tokens
- Expo Linear Gradient for UI effects

### Backend
- Node.js + Express
- PostgreSQL with pgvector extension (for vector embeddings)
- Redis (for job queue and caching)
- Optional: Azure AI Video Indexer (for advanced video analysis)
- Optional: OpenAI API (for AI-powered categorization)

## Setup Instructions

### Prerequisites
- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- **npm** or **yarn** (comes with Node.js)
- **Docker Desktop** - [Download Docker Desktop](https://www.docker.com/products/docker-desktop/) (for running PostgreSQL and Redis)
- **Expo CLI** (optional, can use `npx expo` instead): `npm install -g expo-cli`
- **iOS Simulator** (macOS only) or **Android Emulator** (for testing)

### Mobile App Setup

1. Navigate to the app directory:
   ```bash
   cd TikSaveRN
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure the API URL in `src/config/index.ts`:
   ```typescript
   apiBaseURL: __DEV__ 
     ? 'http://localhost:3000/api'  // Development - adjust if backend runs on different port
     : 'https://your-production-api.com/api', // Production - update with your production URL
   ```

4. Start the development server:
   ```bash
   npx expo start
   ```

5. Run on your preferred platform:
   - Press `i` for iOS Simulator (macOS only)
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go app on your physical device

### Backend Setup

For detailed backend setup instructions, see `backend/START-BACKEND.md`.

Quick start:
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the database (requires Docker):
   ```bash
   cd ../database
   docker-compose up -d
   cd ../backend
   ```

4. Create a `.env` file in the `backend` directory with:
   ```env
   DATABASE_URL=postgresql://tiksave:tiksave_password@localhost:5432/tiksave
   REDIS_URL=redis://localhost:6379
   PORT=3000
   NODE_ENV=development
   ```

5. Run database migrations:
   ```bash
   npm run migrate
   ```

6. Start the server:
   ```bash
   npm run dev
   ```

## Optional: API Keys for Enhanced Features

The app works without these API keys, but some features will be limited:

- **OpenAI API key** - Enables AI-powered categorization and semantic search
  - Get one at: [platform.openai.com](https://platform.openai.com/)
  - Add to `.env`: `OPENAI_API_KEY=your_key_here`

- **Azure Video Indexer** - Enables advanced video analysis and transcription
  - Requires an Azure account: [azure.microsoft.com](https://azure.microsoft.com/)
  - Add to `.env`:
    ```env
    AZURE_VIDEO_INDEXER_KEY=your_key_here
    AZURE_VIDEO_INDEXER_ACCOUNT_ID=your_account_id_here
    AZURE_VIDEO_INDEXER_LOCATION=your_location_here
    ```

**Note:** Without these keys, the app will still function but AI-powered features like automatic folder suggestions and video transcription will be disabled.

## Building for Production

### iOS
```bash
cd TikSaveRN
eas build --platform ios
```

### Android
```bash
cd TikSaveRN
eas build --platform android
```

## License

MIT License
