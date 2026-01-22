# Starting the Backend Server

## Prerequisites

Before starting the backend server, you need:

1. **Bun 1.0+** installed on your system (Recommended)
2. **Node.js 18+** installed (Optional fallback)
3. **Docker Desktop** installed and running (for PostgreSQL and Redis)

## Step 1: Start the Database

The backend requires PostgreSQL (with pgvector extension) and Redis. The easiest way to run these is using Docker.

1. Open a terminal (Command Prompt, PowerShell, or your preferred terminal)
2. Navigate to the database directory from the project root:
   ```bash
   cd database
   ```
3. Start PostgreSQL and Redis using Docker Compose:
   ```bash
   docker-compose up -d
   ```
4. Wait a few seconds for the containers to be ready. You can verify they're running with:
   ```bash
   docker ps
   ```
   You should see both `tiksave-postgres` and `tiksave-redis` containers with "healthy" status.

### Alternative: Using Local Database Installations

If you prefer not to use Docker, you can install PostgreSQL and Redis locally:
- **PostgreSQL**: Install from [postgresql.org](https://www.postgresql.org/download/) and enable the pgvector extension
- **Redis**: Install from [redis.io](https://redis.io/download)

Then update your `.env` file with the appropriate connection strings.

## Step 2: Configure Environment Variables

Create a `.env` file in the `backend` directory if it doesn't exist. You can copy from `.env.example` if available, or create one with these variables:

```env
# Database Configuration
DATABASE_URL=postgresql://tiksave:tiksave_password@localhost:5432/tiksave
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=3000
NODE_ENV=development

# Azure Video Indexer Configuration (Required)
# The app requires Azure Video Indexer for video processing and analysis
AZURE_VIDEO_INDEXER_KEY=your_azure_key_here
AZURE_VIDEO_INDEXER_ACCOUNT_ID=your_account_id_here
AZURE_VIDEO_INDEXER_LOCATION=your_location_here

# Optional: OpenAI API Key for Enhanced Features
# OPENAI_API_KEY=your_openai_api_key_here
```

**Note:** Azure Video Indexer is **required** for the app to function. The app relies on it for video processing and analysis. OpenAI API key is optional and only needed for additional AI-powered features like automatic categorization.

## Step 3: Install Dependencies

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   bun install
   ```

## Step 4: Run Database Migrations

Set up the database schema:
```bash
bun run migrate
```

## Step 5: Start the Server

Start the development server:
```bash
bun run dev
```

## Verify Server is Running

Once started, you should see output like:
```
✅ Database initialized
✅ Background worker started
🚀 Server running on http://localhost:3000
```

Test the server by visiting: http://localhost:3000/health

You should see a response like: `{"status":"ok","timestamp":"..."}`

## Troubleshooting

### Database Connection Error (ECONNREFUSED)

If you see `ECONNREFUSED` error on port 5432:
1. Make sure Docker Desktop is running
2. Verify the database containers are running: `docker ps`
3. If containers aren't running, start them: `cd database && docker-compose up -d`
4. Check that your `.env` file has the correct `DATABASE_URL`
5. Wait a few seconds after starting containers for them to become healthy

### Port Already in Use

If port 3000 is already in use:
- Change the `PORT` value in your `.env` file
- Or stop the process using port 3000

### PowerShell Execution Policy Error (Windows)

If you encounter execution policy errors in PowerShell, run PowerShell **as Administrator** and execute:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then you can use PowerShell normally.

## Managing the Database

### Stop the Database Containers

To stop PostgreSQL and Redis:
```bash
cd database
docker-compose down
```

### Stop and Remove All Data

To stop containers and remove all stored data (⚠️ This will delete your database):
```bash
cd database
docker-compose down -v
```

### View Database Logs

To see database container logs:
```bash
cd database
docker-compose logs -f
```

