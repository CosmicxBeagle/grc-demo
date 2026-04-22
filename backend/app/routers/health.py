"""
Health and readiness probes.

GET /health/live   — liveness:  always 200 if the process is running
GET /health/ready  — readiness: 200 if DB, schema, and storage are ok
GET /version       — build metadata
"""
import os
import time
from datetime import datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.db.database import engine
from app.config import settings

router = APIRouter(tags=["health"])


@router.get("/health/live", include_in_schema=False)
def liveness():
    return {"status": "ok"}


@router.get("/health/ready")
def readiness():
    checks: dict = {}
    overall = "ready"

    # ── Database ──────────────────────────────────────────────────────────────
    t0 = time.perf_counter()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        checks["database"] = {"status": "ok", "latency_ms": latency_ms, "detail": None}
    except Exception as exc:
        checks["database"] = {"status": "error", "latency_ms": None, "detail": str(exc)}
        overall = "not_ready"

    # ── Schema version ────────────────────────────────────────────────────────
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT version_num FROM alembic_version LIMIT 1")
            ).fetchone()
        current = row[0] if row else None
        # For SQLite dev we don't run alembic, so just report current version
        checks["schema_version"] = {
            "status": "ok",
            "current": current,
            "detail": None,
        }
    except Exception as exc:
        checks["schema_version"] = {"status": "error", "current": None, "detail": str(exc)}
        # Degraded, not not_ready
        if overall == "ready":
            overall = "degraded"

    # ── Evidence storage ──────────────────────────────────────────────────────
    evidence_dir = settings.evidence_upload_dir
    try:
        import pathlib
        p = pathlib.Path(evidence_dir)
        if not p.exists():
            checks["evidence_storage"] = {"status": "error", "detail": f"Path does not exist: {evidence_dir}"}
            if overall == "ready":
                overall = "degraded"
        else:
            # Check writability
            test_file = p / ".healthcheck"
            test_file.write_text("ok")
            test_file.unlink()
            checks["evidence_storage"] = {"status": "ok", "detail": str(p.resolve())}
    except Exception as exc:
        checks["evidence_storage"] = {"status": "error", "detail": str(exc)}
        if overall == "ready":
            overall = "degraded"

    status_code = 200 if overall in ("ready", "degraded") else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": overall, "checks": checks},
    )


@router.get("/version", include_in_schema=False)
def version():
    app_version = os.environ.get("APP_VERSION", "dev")
    # Try to get current alembic revision
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT version_num FROM alembic_version LIMIT 1")
            ).fetchone()
        schema_revision = row[0] if row else "unknown"
    except Exception:
        schema_revision = "unknown"

    return {
        "api_version": "v1",
        "app_version": app_version,
        "schema_revision": schema_revision,
    }
