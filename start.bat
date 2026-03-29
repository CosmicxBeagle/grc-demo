@echo off
title GRC Demo Launcher
echo.
echo ================================================
echo         GRC Demo - Local Startup
echo ================================================
echo.

:: Add Node.js to PATH for this session
set PATH=C:\Program Files\nodejs;%PATH%

:: Kill anything on ports 8000 and 3002
echo Freeing ports...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3002 "') do taskkill /f /pid %%a >nul 2>&1
timeout /t 2 /nobreak >nul

:: Start backend
echo Starting backend on port 8000...
start "GRC Backend" cmd /k "cd /d C:\Users\johnf\grc-demo\backend && venv\Scripts\pip.exe install --quiet python-multipart 2>nul && venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Start frontend using npm (simpler, no path issues)
echo Starting frontend on port 3002...
start "GRC Frontend" /d "C:\Users\johnf\grc-demo\frontend" cmd /k "set PATH=C:\Program Files\nodejs;%PATH% && npm run dev -- --port 3002"

:: Wait for Next.js to compile
echo.
echo Waiting 25 seconds for Next.js to compile...
timeout /t 25 /nobreak

:: Open browser
echo Opening browser...
start "" "http://localhost:3002"

echo.
echo ================================================
echo   GRC Demo is running at http://localhost:3002
echo ================================================
echo   Backend API : http://localhost:8000
echo.
echo Close the GRC Backend + GRC Frontend windows to stop.
echo.
pause
