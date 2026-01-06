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
- PostgreSQL with pgvector (for embeddings)
- Redis (job queue)
- Azure AI Video Indexer

## Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (macOS) or Android Emulator

### Mobile App

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
     ? 'http://localhost:3000/api'  // Development
     : 'https://your-production-api.com/api', // Production
   ```

4. Start the development server:
   ```bash
   npx expo start
   ```

5. Run on your preferred platform:
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go app on your device

### Backend

1. Navigate to the backend:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and configure your environment variables

4. Run database migrations:
   ```bash
   npm run migrate
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

## API Keys Required

- Azure Video Indexer account
- OpenAI API key (for embeddings)

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
