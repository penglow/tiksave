# Backend Startup Script
# Run this script to start the backend server

Write-Host "Starting TikSave Backend Server..." -ForegroundColor Green
Write-Host ""

Set-Location $PSScriptRoot

Write-Host "Installing dependencies..." -ForegroundColor Yellow
bun install

Write-Host "Starting development server..." -ForegroundColor Cyan
Write-Host "Backend will be available at: http://localhost:3000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

bun run dev

