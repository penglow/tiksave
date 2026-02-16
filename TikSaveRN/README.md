# TikSaveRN

Expo React Native client for TikSave.

## Current App Surface

The app uses an auth gate plus a 5-tab main navigator:

- Library
- Import
- Search
- Map
- Settings

Key screens/components in active use include:

- `src/screens/LibraryScreen.tsx`
- `src/screens/AddVideoScreen.tsx`
- `src/screens/SearchScreen.tsx`
- `src/screens/MapScreen.native.tsx`
- `src/screens/MapScreen.web.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/screens/VideoDetailScreen.tsx`
- `src/components/ProcessingProgress.tsx`

## Stack

- Expo 54
- React Native 0.81
- React 19
- TypeScript
- React Navigation
- Zustand

## Prerequisites

- Bun 1.x
- Backend running on port `3000`

## Install and Run

```powershell
cd TikSaveRN
bun install
bun run start
```

Shortcuts:

- `bun run ios`
- `bun run android`
- `bun run web`

## iOS Share Extension

The client is configured to use `expo-share-extension` so shared TikTok links can open TikSave with the import URL prefilled.

Files involved:

- `index.share.js`
- `src/share/ShareExtension.tsx`
- `metro.config.js` (`withShareExtension`)
- `app.json` plugin config

After dependency install, run prebuild before iOS native builds:

```powershell
cd TikSaveRN
bun install
npx expo prebuild --platform ios
```

Quality checks:

- `bun run lint`
- `bun run typecheck`

## API Configuration

API base URL is resolved in `src/config/index.ts`:

1. `expoConfig.extra.apiHost`
2. Expo host URI (for physical devices)
3. `localhost`

Development defaults:

- Web: `http://localhost:3000/api`
- Native: `http://<detected-host>:3000/api`

## Backend Contract

Client integrates with:

- `/api/auth`
- `/api/items` (including batch import, map data, progress)
- `/api/folders`
- `/api/search`

Implementation is in `src/services/api.ts`.
