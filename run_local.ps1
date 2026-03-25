# ─────────────────────────────────────────────────────────────────────────────
# run_local.ps1  —  Start the GRC Demo locally on Windows
# Usage:  .\run_local.ps1
# ─────────────────────────────────────────────────────────────────────────────

$Root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "        GRC Demo - Local Startup                " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ── Backend setup ──────────────────────────────────────────────────────────
Set-Location $Backend

if (-Not (Test-Path "venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

Write-Host "Installing backend requirements..." -ForegroundColor Yellow
& "venv\Scripts\pip.exe" install --quiet -r requirements.txt 2>$null

# Seed sample data if DB doesn't exist
if (-Not (Test-Path "grc_demo.db")) {
    Write-Host "Seeding sample data..." -ForegroundColor Yellow
    & "venv\Scripts\python.exe" -m data.sample_data
}

# ── Start backend in new window ────────────────────────────────────────────
Write-Host "Starting FastAPI backend on http://localhost:8000 ..." -ForegroundColor Green
$backendCmd = "cd `"$Backend`"; `$Host.UI.RawUI.WindowTitle = 'GRC Backend'; venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# ── Frontend setup ─────────────────────────────────────────────────────────
Set-Location $Frontend

if (-Not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies (first run - takes a moment)..." -ForegroundColor Yellow
    npm install
}

# ── Start frontend in new window ───────────────────────────────────────────
Write-Host "Starting Next.js frontend on http://localhost:3000 ..." -ForegroundColor Green
$frontendCmd = "cd `"$Frontend`"; `$Host.UI.RawUI.WindowTitle = 'GRC Frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

# ── Wait then open browser ─────────────────────────────────────────────────
Write-Host ""
Write-Host "Waiting for servers to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  GRC Demo is running!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:3000" -ForegroundColor White
Write-Host "  Backend  : http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs : http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "Close the two GRC terminal windows to stop." -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to close this launcher"
