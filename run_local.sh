#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run_local.sh  —  Start the GRC Demo locally (backend + frontend)
# Usage:  bash run_local.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        GRC Demo — Local Startup           ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Backend setup ──────────────────────────────────────────────────────────
echo "▶  Setting up Python virtual environment…"
cd "$BACKEND"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate

pip install --quiet -r requirements.txt

# Seed sample data if DB doesn't exist yet
if [ ! -f "grc_demo.db" ]; then
  echo "▶  Seeding sample data…"
  python -m data.sample_data
fi

# ── Start backend ──────────────────────────────────────────────────────────
echo "▶  Starting FastAPI backend on http://localhost:8000 …"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# ── Frontend setup ─────────────────────────────────────────────────────────
echo "▶  Installing frontend dependencies…"
cd "$FRONTEND"

if [ ! -d "node_modules" ]; then
  npm install
fi

# ── Start frontend ─────────────────────────────────────────────────────────
echo "▶  Starting Next.js frontend on http://localhost:3000 …"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅  GRC Demo is running!"
echo "   Frontend : http://localhost:3000"
echo "   Backend  : http://localhost:8000"
echo "   API Docs : http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Wait for both and clean up on Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" INT TERM
wait $BACKEND_PID $FRONTEND_PID
