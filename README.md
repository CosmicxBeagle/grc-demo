# GRC Control Testing Platform

A browser-based Governance, Risk & Compliance platform for control testing, deficiency tracking, risk management, and audit workflows.

**Stack:** Next.js 16 (frontend) · FastAPI (backend) · SQLite (local dev) / PostgreSQL (production)

---

## Prerequisites

| Tool | Version | Download |
|---|---|---|
| Python | 3.11+ | https://python.org |
| Node.js | 18+ | https://nodejs.org |
| Git | any | https://git-scm.com |

---

## Quick Start (Windows)

1. **Clone the repo**
   ```
   git clone https://github.com/CosmicxBeagle/grc-demo.git
   cd grc-demo
   ```

2. **Configure the backend**
   ```
   copy backend\.env.example backend\.env
   ```
   Open `backend\.env` and set:
   ```
   DEMO_AUTH_ENABLED=true
   ```
   Everything else can stay as-is for local dev.

3. **Install backend dependencies**
   ```
   cd backend
   python -m venv venv
   venv\Scripts\pip install -r requirements.txt
   cd ..
   ```

4. **Install frontend dependencies**
   ```
   cd frontend
   npm install
   cd ..
   ```

5. **Start the app**

   Double-click `start.bat` — it will:
   - Kill anything already on ports 8000 and 3002
   - Start the FastAPI backend on `http://localhost:8000`
   - Start the Next.js frontend on `http://localhost:3002`
   - Open the browser automatically after 25 seconds

---

## Manual Start (any OS)

If you're not on Windows or prefer to run the servers yourself:

**Terminal 1 — Backend**
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm install
npm run dev -- --port 3002
```

Then open `http://localhost:3002` in your browser.

---

## Signing In (Demo Mode)

With `DEMO_AUTH_ENABLED=true` the login page shows a user picker — no password needed. Pick any user to log in as that role:

| User | Role | What they can do |
|---|---|---|
| Alice Admin | admin | Everything |
| Grace Manager | grc_manager | Approve exceptions, manage reviews |
| Henry Analyst | grc_analyst | View all, create risks/deficiencies |
| Bob Tester | tester | Run assigned control tests |
| Carol Tester | tester | Run assigned control tests |
| Dave Reviewer | reviewer | Review and approve test results |
| Erin Reviewer | reviewer | Review and approve test results |
| Frank Owner | risk_owner | Review and update their own risks |

---

## Project Structure

```
grc-demo/
├── backend/              # FastAPI app
│   ├── app/
│   │   ├── main.py       # App entry point, middleware, CORS
│   │   ├── config.py     # Settings (reads from .env)
│   │   ├── models/       # SQLAlchemy models
│   │   ├── routers/      # API route handlers
│   │   ├── auth/         # Auth helpers (demo + Okta)
│   │   └── middleware/   # Correlation IDs, session refresh
│   ├── data/             # SQLite DB and evidence uploads (local only)
│   ├── requirements.txt
│   └── .env.example      # Copy to .env and edit
│
├── frontend/             # Next.js app
│   ├── src/
│   │   ├── app/          # Pages (App Router)
│   │   ├── components/   # Shared UI components
│   │   ├── lib/          # API client, auth helpers, telemetry
│   │   ├── hooks/        # Custom React hooks
│   │   └── types/        # TypeScript types
│   └── next.config.mjs   # Proxy config, security headers
│
└── start.bat             # One-click Windows launcher
```

---

## Backend Environment Variables

Copy `backend/.env.example` to `backend/.env`. Key settings:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./grc_demo.db` | SQLite for local dev; use `postgresql://...` for production |
| `DEMO_AUTH_ENABLED` | `false` | Set to `true` for local demo mode (no SSO required) |
| `CORS_ORIGINS` | `http://localhost:3002` | Comma-separated list of allowed frontend origins |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | — | Optional email for notifications |
| `OKTA_DOMAIN` / `OKTA_CLIENT_ID` / `OKTA_CLIENT_SECRET` | — | Leave blank unless using Okta SSO |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` | — | Leave blank unless using Entra ID SSO |

---

## API Docs

With the backend running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Troubleshooting

**Login page shows "Authentication is not configured"**
- Make sure `DEMO_AUTH_ENABLED=true` is set in `backend/.env`
- Make sure the backend is running on port 8000 (`http://localhost:8000/v1/auth/config` should return JSON)
- Hard-refresh the browser (`Ctrl+Shift+R`) to clear any cached assets

**Port already in use**
- `start.bat` handles this automatically on Windows
- Manually: kill whatever is on port 8000 or 3002, then restart

**`pip install` fails on psycopg2**
- For local SQLite dev you don't need PostgreSQL drivers — replace `psycopg2-binary` with nothing, or just ignore the warning; SQLite is the default

**Frontend shows blank page or hydration errors**
- Run `npm install` again from the `frontend/` directory
- Delete `frontend/.next/` and restart the dev server
