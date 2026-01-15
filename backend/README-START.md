# Starting the Backend Server

## Quick Start

1. **Prerequisites**: Make sure you have:
   - Node.js 18+ installed
   - Docker Desktop installed and running
   - Database containers started (see `START-BACKEND.md` for details)

2. Open a terminal window (PowerShell, Command Prompt, or your preferred terminal)

3. Navigate to the backend directory:
   ```bash
   cd backend
   ```

4. Install dependencies (if you haven't already):
   ```bash
   npm install
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

## Keep the Window Open!

**IMPORTANT:** The backend server must stay running while you're using the app. Keep the terminal window open.

To stop the server, press `Ctrl+C` in the terminal window.

## Verification

Once started, you should see:
```
✅ Database initialized
✅ Background worker started
🚀 Server running on port 3000
```

You can test if it's running by visiting: http://localhost:3000/health

You should see a JSON response with `{"status":"ok","timestamp":"..."}`

## Troubleshooting

- **Port 3000 already in use**: Change the `PORT` value in your `.env` file or stop the process using port 3000
- **Database connection errors**: Make sure Docker is running and the database containers are started (see `START-BACKEND.md`)
- **Missing dependencies**: Run `npm install` in the backend directory
- **Environment variables**: Make sure you have a `.env` file configured (see `START-BACKEND.md` for details)
- Check the terminal output for any error messages

For more detailed setup instructions, see `START-BACKEND.md`.

