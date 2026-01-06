# TikSave - React Native

A cross-platform mobile app for organizing your saved TikTok videos with AI-powered categorization. Built with React Native and Expo.

## Features

- **📥 Smart Inbox** - Incoming videos categorized by status (processing, needs review, recently filed)
- **📁 Folder Organization** - Hierarchical folder structure with custom icons
- **🔍 Smart Search** - Semantic and keyword search powered by AI
- **🤖 AI Categorization** - Automatic folder suggestions based on video content
- **🎨 Beautiful Dark UI** - Modern, sleek interface with gradient accents

## Tech Stack

- **React Native** with Expo SDK 51
- **TypeScript** for type safety
- **React Navigation** for navigation
- **Zustand** for state management
- **Expo Secure Store** for secure token storage
- **Expo Linear Gradient** for beautiful gradients

## Project Structure

```
TikSaveRN/
├── App.tsx                    # App entry point
├── src/
│   ├── components/            # Reusable components
│   │   └── MoveFolderModal.tsx
│   ├── config/                # App configuration & theme
│   │   └── index.ts
│   ├── navigation/            # Navigation setup
│   │   ├── types.ts
│   │   ├── RootNavigator.tsx
│   │   └── MainNavigator.tsx
│   ├── screens/               # App screens
│   │   ├── AuthScreen.tsx
│   │   ├── InboxScreen.tsx
│   │   ├── FoldersScreen.tsx
│   │   ├── FolderDetailScreen.tsx
│   │   ├── SearchScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── VideoDetailScreen.tsx
│   ├── services/              # API services
│   │   └── api.ts
│   ├── stores/                # State management
│   │   ├── authStore.ts
│   │   └── appStore.ts
│   ├── types/                 # TypeScript types
│   │   └── index.ts
│   └── utils/                 # Utility functions
│       └── date.ts
├── assets/                    # App icons & splash
├── app.json                   # Expo configuration
├── package.json
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (macOS) or Android Emulator

### Installation

1. Navigate to the React Native project:
   ```bash
   cd TikSaveRN
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npx expo start
   ```

4. Run on your preferred platform:
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go app on your device

### Configuration

Update the API base URL in `src/config/index.ts`:

```typescript
apiBaseURL: __DEV__ 
  ? 'http://localhost:3000/api'  // Development
  : 'https://your-production-api.com/api', // Production
```

## Backend Integration

This app connects to the same Node.js backend as the iOS version. Make sure the backend is running:

```bash
cd ../backend
npm install
npm run dev
```

## Screens

### Auth Screen
- Email/password login and registration
- Beautiful gradient background
- Secure token storage

### Inbox Screen
- **Processing Section** - Videos currently being analyzed
- **Needs Review Section** - Videos that need manual folder assignment
- **Recently Filed Section** - Successfully categorized videos

### Folders Screen
- Hierarchical folder tree view
- Expandable/collapsible parent folders
- Create new folders with custom icons
- Long-press to select parent folder

### Search Screen
- **Semantic Search** - Find videos by meaning
- **Keyword Search** - Traditional text matching
- Recent searches history
- Suggested search queries

### Settings Screen
- Video upload toggle
- Auto-file confidence threshold
- Theme selection
- Cache management
- Account management

## Styling

The app uses a consistent dark theme with:
- Background: `#12121F`
- Primary: `#06B6D4` (cyan)
- Secondary: `#A855F7` (purple)
- Gradients for interactive elements

## Building for Production

### iOS
```bash
npx expo build:ios
# or with EAS
eas build --platform ios
```

### Android
```bash
npx expo build:android
# or with EAS
eas build --platform android
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

