"""
Legal Deadline Manager — FastAPI Application Entry Point
Runs on http://127.0.0.1:8000 (localhost only — never exposed to network)

Start with:  python main.py
Or dev mode: uvicorn main:app --reload --host 127.0.0.1 --port 8000
"""

import os
import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from loguru import logger

from config import get_settings
from database.connection import init_db
from scheduler.jobs import start_scheduler, stop_scheduler

# ── Import API routers (add as they are built) ─────────────────────────────
from api import cases, deadlines, scheduling_orders, reports, auth

settings = get_settings()


# ── Startup / Shutdown ────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and start scheduler on startup."""
    logger.info(f"Starting Legal Deadline Manager ({settings.app_env})")
    logger.info(f"Firm: {settings.firm_name}")

    # Ensure data directories exist
    Path("data/reports").mkdir(parents=True, exist_ok=True)

    # Initialize database
    await init_db()
    logger.info("Database initialized.")

    # Start background scheduler
    start_scheduler()
    logger.info(f"Scheduler started. Daily sheet will generate at {settings.daily_sheet_time}.")

    yield

    # Shutdown
    stop_scheduler()
    logger.info("Scheduler stopped. Goodbye.")


# ── FastAPI App ────────────────────────────────────────────────────────────
app = FastAPI(
    title="Legal Deadline Manager",
    description="Court deadline tracking and attorney daily sheet generator",
    version="1.0.0",
    lifespan=lifespan,
    # Disable docs in production to reduce attack surface
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url=None,
)

# Static files
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Templates
templates = Jinja2Templates(directory="frontend/templates")

# ── Security: Enforce localhost-only access ────────────────────────────────
@app.middleware("http")
async def localhost_only(request: Request, call_next):
    """
    Reject any request not originating from loopback.
    Belt-and-suspenders: the server is already bound to 127.0.0.1.
    """
    client_host = request.client.host if request.client else "unknown"
    if client_host not in ("127.0.0.1", "::1", "localhost"):
        from fastapi.responses import JSONResponse
        logger.warning(f"Rejected request from non-localhost: {client_host}")
        return JSONResponse(status_code=403, content={"detail": "Access denied"})
    return await call_next(request)


# ── Include API routers ────────────────────────────────────────────────────
app.include_router(cases.router, prefix="/api/cases", tags=["Cases"])
app.include_router(deadlines.router, prefix="/api/deadlines", tags=["Deadlines"])
app.include_router(scheduling_orders.router, prefix="/api/orders", tags=["Scheduling Orders"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])


# ── UI Routes ─────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request, "firm_name": settings.firm_name})

@app.get("/cases", response_class=HTMLResponse)
async def cases_page(request: Request):
    return templates.TemplateResponse("cases.html", {"request": request})

@app.get("/deadlines", response_class=HTMLResponse)
async def deadlines_page(request: Request):
    return templates.TemplateResponse("deadlines.html", {"request": request})

@app.get("/thirty-day", response_class=HTMLResponse)
async def thirty_day_view(request: Request):
    """The 30-day horizon view — main daily workflow screen."""
    return templates.TemplateResponse("thirty_day.html", {"request": request})

@app.get("/upload", response_class=HTMLResponse)
async def upload_page(request: Request):
    return templates.TemplateResponse("upload.html", {"request": request})

@app.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request):
    return templates.TemplateResponse("settings.html", {"request": request})


# ── Entry Point ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import threading
    import time

    def open_browser():
        time.sleep(1.5)
        webbrowser.open(f"http://127.0.0.1:{settings.app_port}")

    threading.Thread(target=open_browser, daemon=True).start()

    uvicorn.run(
        "main:app",
        host=settings.app_host,   # Always 127.0.0.1
        port=settings.app_port,
        reload=settings.app_env == "development",
        log_level=settings.log_level.lower(),
    )
