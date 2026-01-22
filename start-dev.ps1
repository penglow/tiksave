# TikSave Development Startup Script
# This script starts both the backend and frontend servers

Write-Host "=== TikSave Development Environment ===" -ForegroundColor Cyan
Write-Host ""

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start Backend
Write-Host "Starting Backend Server..." -ForegroundColor Green
$backendPath = Join-Path $scriptDir "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host '=== TikSave Backend ===' -ForegroundColor Cyan; Write-Host 'Running on http://localhost:3000' -ForegroundColor Green; Write-Host 'Keep this window open!' -ForegroundColor Yellow; Write-Host ''; bun run dev"

# Wait a bit for backend to start
Write-Host "Waiting for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Start Frontend
Write-Host "Starting Frontend (Web)..." -ForegroundColor Green
$frontendPath = Join-Path $scriptDir "TikSaveRN"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host '=== TikSave Frontend ===' -ForegroundColor Cyan; Write-Host 'Starting Expo web server...' -ForegroundColor Green; Write-Host 'Keep this window open!' -ForegroundColor Yellow; Write-Host ''; bun run web"

Write-Host ""
Write-Host "✅ Both servers are starting in separate windows" -ForegroundColor Green
Write-Host ""
Write-Host "Backend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: Check the frontend window for the web URL (usually http://localhost:19006)" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  Keep both PowerShell windows open while developing!" -ForegroundColor Yellow
Write-Host ""

