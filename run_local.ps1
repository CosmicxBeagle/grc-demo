# ─────────────────────────────────────────────────────────────────────────────
# run_local.ps1  —  Start the GRC Demo locally on Windows
# ─────────────────────────────────────────────────────────────────────────────

$Root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$NodeExe  = "C:\Program Files\nodejs\node.exe"
$NextBin  = Join-Path $Frontend "node_modules\next\dist\bin\next"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "        GRC Demo - Local Startup                " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ── Kill ports 3002 and 8000 ──────────────────────────────────────────────
Write-Host "Freeing ports..." -ForegroundColor Yellow
foreach ($port in @(3002, 8000)) {
    $lines = cmd /c "netstat -ano" 2>$null | Select-String ":$port "
    foreach ($line in $lines) {
        $pid = ($line.ToString().Trim() -split '\s+')[-1]
        if ($pid -match '^\d+$' -and $pid -ne '0') {
            cmd /c "taskkill /F /PID $pid" 2>$null | Out-Null
        }
    }
}
Start-Sleep -Seconds 1

# ── Backend ────────────────────────────────────────────────────────────────
Set-Location $Backend

if (-Not (Test-Path "venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

Write-Host "Installing backend requirements..." -ForegroundColor Yellow
& "venv\Scripts\pip.exe" install --quiet -r requirements.txt 2>$null

if (-Not (Test-Path "grc_demo.db")) {
    Write-Host "Seeding sample data..." -ForegroundColor Yellow
    & "venv\Scripts\python.exe" -m data.sample_data
}

Write-Host "Starting backend on port 8000..." -ForegroundColor Green
$uvicorn = Join-Path $Backend "venv\Scripts\uvicorn.exe"
$backendScript = "& `"$uvicorn`" app.main:app --host 0.0.0.0 --port 8000 --reload --app-dir `"$Backend`""
Start-Process powershell -WorkingDirectory $Backend -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='GRC Backend'; Set-Location '$Backend'; $backendScript"

# ── Frontend ───────────────────────────────────────────────────────────────
# Clear Next.js build cache to prevent stale CSS issues
$NextCache = Join-Path $Frontend ".next"
if (Test-Path $NextCache) {
    Write-Host "Clearing Next.js cache..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $NextCache
}

Write-Host "Starting frontend on port 3002..." -ForegroundColor Green
$frontendScript = "`$Host.UI.RawUI.WindowTitle='GRC Frontend'; Set-Location '$Frontend'; & `"$NodeExe`" `"$NextBin`" dev --port 3002"
Start-Process powershell -WorkingDirectory $Frontend -ArgumentList "-NoExit", "-Command", $frontendScript

# ── Wait until port 3002 is accepting connections ─────────────────────────
Write-Host ""
Write-Host "Waiting for frontend (this takes ~15s on first run)..." -ForegroundColor Yellow
$ready = $false
for ($i = 1; $i -le 45; $i++) {
    Start-Sleep -Seconds 2
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $ar  = $tcp.BeginConnect("127.0.0.1", 3002, $null, $null)
        if ($ar.AsyncWaitHandle.WaitOne(500)) {
            $tcp.EndConnect($ar)
            if ($tcp.Connected) { $ready = $true }
        }
        $tcp.Close()
    } catch {}
    if ($ready) { break }
    Write-Host "  Still compiling... ($($i * 2)s)" -ForegroundColor Gray
}

Start-Process "http://localhost:3002"

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  GRC Demo is running!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:3002" -ForegroundColor White
Write-Host "  Backend  : http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "Close the two GRC windows to stop the servers." -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to close this launcher"
