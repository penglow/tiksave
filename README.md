# TikSave 🚀

A high-performance mobile application that transforms your saved TikTok videos into an organized, searchable library with AI-powered categorization.

Now powered by **Bun** for blazing-fast development and execution.

## 🌟 Key Features

- **📥 Smart Inbox** - Auto-sorts incoming videos into "Processing", "Needs Review", and "Filed" status.
- **📁 AI Folder Organization** - Hierarchical folder structure with AI-suggested icons and placement.
- **🔍 Semantic Search** - Find videos by *meaning*, not just keywords, powered by vector embeddings.
- **🤖 Intelligence** - Automatic categorization based on video transcripts and visual content.
- **🎨 Modern UI** - Beautiful glassmorphic design with full Dark Mode support.

## 📂 Project Structure

```text
├── TikSaveRN/          # Mobile App (React Native + Expo SDK 54)
├── backend/            # Bun API Server (Express + Bull + OpenAI)
├── database/           # Docker configuration for PostgreSQL + Redis
└── start-dev.ps1       # One-click startup script (Windows)
```

## ⚡ Tech Stack

| Component | Technology | Why? |
| :--- | :--- | :--- |
| **Runtime** | [Bun](https://bun.sh) | Blazing fast execution and package management |
| **Mobile** | React Native / Expo | Cross-platform performance and ease of updates |
| **State** | Zustand | Lightweight and robust state management |
| **Database** | PostgreSQL + pgvector | Industry standard with AI vector support |
| **Queue** | Redis + Bull | Reliable background video processing |
| **AI** | OpenAI + Azure Video Indexer | State-of-the-art content analysis |

## 🛠️ Quick Start

### 1. Prerequisites
- **Bun** (Installed automatically in recent migration)
- **Node.js** (Required for some Expo native tools)
- **Docker Desktop** (For database and cache)

### 2. Automatic Setup
Run the startup script to launch both the backend and frontend simultaneously:
```powershell
.\start-dev.ps1
```

### 3. Manual Setup

#### **Database**
```bash
cd database
docker-compose up -d
```

#### **Backend**
```bash
cd backend
bun install
bun run migrate
bun run dev
```

#### **Mobile App**
```bash
cd TikSaveRN
bun install
bun start
```

## ⚙️ Configuration

Create a `.env` file in the `backend/` directory:

```env
# Infrastructure
DATABASE_URL=postgresql://tiksave:tiksave_password@localhost:5432/tiksave
REDIS_URL=redis://localhost:6379

# AI Services (Required)
AZURE_VIDEO_INDEXER_KEY=your_key
AZURE_VIDEO_INDEXER_ACCOUNT_ID=your_id
AZURE_VIDEO_INDEXER_LOCATION=your_location
OPENAI_API_KEY=your_key
```

## 🏗️ Production

### Mobile
```bash
cd TikSaveRN
bunx eas build --platform ios    # For iOS
bunx eas build --platform android # For Android
```

---
*Built with ❤️ for better video organization.*
