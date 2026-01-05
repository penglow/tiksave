# TikSave - Complete Setup Guide

This guide walks you through setting up the complete TikSave application, including the iOS app, backend server, and required services.

## Prerequisites

### For iOS Development
- macOS with Xcode 15+
- Apple Developer account (for app signing)
- iOS 17+ device or simulator

### For Backend Development  
- Node.js 18+
- Docker & Docker Compose (for local databases)
- Azure account with:
  - Video Indexer service
  - Blob Storage account
- OpenAI API key (for embeddings/semantic search)

---

## Part 1: Backend Setup

### Step 1: Start Local Databases

```bash
cd database
docker-compose up -d
```

This starts:
- PostgreSQL with pgvector extension (port 5432)
- Redis for job queue (port 6379)

### Step 2: Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Server
PORT=3000
NODE_ENV=development

# Database (if using Docker)
DATABASE_URL=postgresql://tiksave:tiksave_password@localhost:5432/tiksave

# Redis
REDIS_URL=redis://localhost:6379

# JWT (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# Azure Video Indexer
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group
AZURE_VIDEO_INDEXER_ACCOUNT_ID=your-account-id
AZURE_VIDEO_INDEXER_LOCATION=trial
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_STORAGE_CONTAINER=tiksave-videos

# OpenAI
OPENAI_API_KEY=your-openai-api-key
```

### Step 3: Install Dependencies & Run Migrations

```bash
npm install
npm run migrate
```

### Step 4: Seed Test Data (Optional)

```bash
npm run seed
```

This creates a test user:
- Email: `test@example.com`
- Password: `testpassword123`

### Step 5: Start the Server

```bash
npm run dev
```

Server will be running at `http://localhost:3000`

---

## Part 2: Azure Setup

### Video Indexer Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new "Azure Video Indexer" resource
3. Once created, go to the resource and note:
   - Account ID
   - Location
   - Subscription ID
   - Resource Group name

4. Create an App Registration for API access:
   - Go to "Azure Active Directory" > "App registrations"
   - Create new registration
   - Note the Client ID and Tenant ID
   - Create a client secret and save it

5. Grant permissions:
   - Go to your Video Indexer resource
   - Access Control (IAM) > Add role assignment
   - Add "Contributor" role to your app registration

### Blob Storage Setup

1. Create a new Storage Account in Azure Portal
2. Create a container named `tiksave-videos`
3. Get the connection string from "Access keys"

---

## Part 3: iOS App Setup

### Step 1: Open in Xcode

1. Open `TikSave.xcodeproj` in Xcode
2. Wait for Swift Package Manager to resolve dependencies

### Step 2: Configure App Group

1. Select the TikSave target
2. Go to "Signing & Capabilities"
3. Add "App Groups" capability
4. Create a new group: `group.com.yourcompany.tiksave`
5. Repeat for the TikSaveExtension target

### Step 3: Update Bundle Identifier

1. Change `com.yourcompany.tiksave` to your own bundle ID
2. Update in:
   - TikSave target > General > Bundle Identifier
   - TikSaveExtension target > General > Bundle Identifier
   - `Config.swift` - update `appGroupIdentifier`
   - Both `.entitlements` files

### Step 4: Configure API URL

Edit `TikSave/App/Config.swift`:

```swift
static let apiBaseURL: String = {
    #if DEBUG
    return "http://localhost:3000/api"  // Or your local IP for device testing
    #else
    return "https://your-production-api.com/api"
    #endif
}()
```

**For testing on a physical device**, use your computer's local IP:
```swift
return "http://192.168.1.XXX:3000/api"
```

### Step 5: Build & Run

1. Select your target device/simulator
2. Build and run (⌘R)

---

## Part 4: Testing the App

### Test the Share Extension

1. Open TikTok on your device/simulator
2. Find a video and tap "Share"
3. Scroll the share sheet and tap "TikSave"
4. The video should appear in your TikSave Inbox

### Test Folder Classification

1. Videos are automatically processed in the background
2. High-confidence items are auto-filed to folders
3. Lower-confidence items appear in "Needs Review"
4. Move items manually to train the AI

### Test Search

1. Go to the Search tab
2. Try semantic search: "quiet hotel with city view"
3. Try keyword search: "ramen tokyo"

---

## Troubleshooting

### Share Extension Not Appearing

1. Make sure App Groups are configured correctly
2. Delete and reinstall the app
3. Restart your device

### API Connection Issues

1. Check the backend is running
2. Verify the API URL in Config.swift
3. For device testing, ensure you're on the same network

### Video Processing Not Working

1. Check Azure credentials in `.env`
2. Verify Video Indexer quota/limits
3. Check backend logs for errors

### Database Connection Failed

1. Ensure Docker containers are running: `docker ps`
2. Check DATABASE_URL in `.env`
3. Try restarting containers: `docker-compose restart`

---

## Production Deployment

### Backend

1. Deploy to your preferred cloud (Azure App Service, AWS, etc.)
2. Set up production PostgreSQL (Azure Database, RDS, etc.)
3. Set up production Redis (Azure Cache, ElastiCache, etc.)
4. Configure environment variables
5. Set up SSL/HTTPS

### iOS App

1. Update API URL to production
2. Configure production signing certificates
3. Submit to App Store

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        iOS App                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  Main App   │  │   Share     │  │    App Group        │   │
│  │  (SwiftUI)  │◄─┤  Extension  │──►   Storage          │   │
│  └──────┬──────┘  └─────────────┘  └─────────────────────┘   │
└─────────┼────────────────────────────────────────────────────┘
          │
          │ REST API
          ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend Server                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Express    │  │   Bull       │  │   Classification │   │
│  │   API        │──►  Job Queue   │──►  Service         │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│         │                 │                   │              │
└─────────┼─────────────────┼───────────────────┼──────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
    ┌──────────┐    ┌──────────────┐    ┌──────────────┐
    │ Postgres │    │ Azure Video  │    │   OpenAI     │
    │ + pgvec  │    │  Indexer     │    │ Embeddings   │
    └──────────┘    └──────────────┘    └──────────────┘
```

---

## API Quick Reference

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/refresh` - Refresh token

### Items
- `POST /api/items` - Create save item
- `GET /api/items` - List items
- `GET /api/items/:id` - Get item details
- `POST /api/items/:id/moveFolder` - Move to folder
- `DELETE /api/items/:id` - Delete item

### Folders
- `GET /api/folders` - List folders
- `POST /api/folders` - Create folder
- `PATCH /api/folders/:id` - Update folder
- `DELETE /api/folders/:id` - Delete folder

### Search
- `GET /api/search?q=query&semantic=true` - Search items

---

## Need Help?

- Check the logs: Backend console, Xcode console
- Review the code comments for implementation details
- Azure Video Indexer docs: https://learn.microsoft.com/azure/azure-video-indexer/

