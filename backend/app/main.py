import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models import models  # noqa: F401 — registers all models with Base
from app.routers import auth, users, controls, test_cycles, evidence, dashboard, deficiencies, assets, threats, risks, exports, exceptions, approvals, risk_reviews, treatment_plans, audit_logs, notifications, checklist, deficiency_milestones, health, my_work, telemetry, scim
from app.routers.treatment_plans import treatment_escalation_router
from app.middleware.correlation import CorrelationMiddleware
from app.middleware.session_refresh import session_refresh_middleware

# ── Startup security guards ───────────────────────────────────────────────────
# These checks run at import time (before the first request) and crash the
# process if the deployment configuration is insecure.  It is intentionally
# impossible to accidentally run an insecure config in a non-local environment.

_INSECURE_SESSION_SECRETS: frozenset[str] = frozenset({
    "local-dev-session-secret-change-me",
    "secret",
    "changeme",
    "change-me",
    "password",
    "",
})

_SESSION_SECRET_MIN_LENGTH = 32

if settings.app_env != "local":
    # 1. SESSION_SECRET — must be set, not a known default, and ≥32 chars.
    _secret = settings.session_secret or ""
    if not _secret or _secret.lower() in _INSECURE_SESSION_SECRETS:
        raise RuntimeError(
            "FATAL: SESSION_SECRET is missing or uses a known-insecure default value. "
            "Set a strong, randomly-generated SESSION_SECRET (≥32 chars) before "
            "deploying to non-local environments. "
            f"Current APP_ENV={settings.app_env!r}."
        )
    if len(_secret) < _SESSION_SECRET_MIN_LENGTH:
        raise RuntimeError(
            f"FATAL: SESSION_SECRET is too short ({len(_secret)} chars). "
            f"Use at least {_SESSION_SECRET_MIN_LENGTH} characters. "
            "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )

    # 2. DEMO_AUTH_ENABLED — must be false in production.  Sandbox / staging
    #    environments may legitimately run without an IdP (no SSO yet), so
    #    demo auth is permitted for any APP_ENV except "production".
    if settings.app_env == "production" and settings.demo_auth_enabled:
        raise RuntimeError(
            "FATAL: DEMO_AUTH_ENABLED=true is not permitted in production. "
            "Demo auth allows login with any username and no password. "
            "Set DEMO_AUTH_ENABLED=false before deploying to production."
        )

    # 3. CORS_ORIGINS — must not contain localhost or wildcard in non-local envs.
    #    A localhost origin in production CORS allows any local process on the
    #    server (or a visitor's machine in some attack scenarios) to make
    #    credentialed cross-origin requests.
    _bad_cors = [
        o for o in settings.cors_origins_list
        if "localhost" in o or "127.0.0.1" in o or o.strip() == "*"
    ]
    if _bad_cors:
        raise RuntimeError(
            "FATAL: CORS_ORIGINS contains insecure origins for a non-local environment: "
            f"{_bad_cors}. "
            "Remove localhost/127.0.0.1/wildcard entries and set only your production "
            f"HTTPS origin(s). Current APP_ENV={settings.app_env!r}."
        )

# ── Audit logger — structured JSON to stdout ──────────────────────────────────
# Azure Container Apps ships stdout to Azure Monitor automatically.
# To forward to Sentinel / any SIEM: add a Diagnostic Setting in Azure Monitor.
_audit_handler = logging.StreamHandler(sys.stdout)
_audit_handler.setFormatter(logging.Formatter("%(message)s"))  # raw JSON, no extra prefix
logging.getLogger("audit").addHandler(_audit_handler)
logging.getLogger("audit").setLevel(logging.INFO)
logging.getLogger("audit").propagate = False

# ── Schema ────────────────────────────────────────────────────────────────────
# Schema is managed exclusively by Alembic.
# - Local dev:  run `alembic upgrade head` once before starting the server,
#               or use start.sh which does it automatically.
# - Production: run migrations as a deliberate release step (e.g. a CI/CD job
#               or init-container) before rolling out new app instances.
#               Set RUN_MIGRATIONS=false in start.sh to skip the auto-run.
# Do NOT add any CREATE TABLE / ALTER TABLE logic here — it creates a second
# schema-evolution path that drifts from the Alembic chain and breaks
# sandbox/prod promotion.




app = FastAPI(
    title=settings.app_name,
    description="GRC Control Testing Platform",
    version="1.0.0",
    docs_url="/docs" if settings.api_docs_enabled else None,
    redoc_url="/redoc" if settings.api_docs_enabled else None,
    openapi_url="/openapi.json" if settings.api_docs_enabled else None,
)

# Always use the explicit origin list from CORS_ORIGINS env var.
# Wildcard ("*") is intentionally avoided: browsers reject credentialed
# requests (withCredentials=true / HttpOnly cookies) when the server
# replies with Access-Control-Allow-Origin: *, even on local dev.
# The .env CORS_ORIGINS already includes all localhost variants we use.
_cors_origins = settings.cors_origins_list or ["http://localhost:3002"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(CorrelationMiddleware)
app.middleware("http")(session_refresh_middleware)

# ── Register routers ──────────────────────────────────────────────────────────

# Unversioned (health probes, version metadata)
app.include_router(health.router)

# v1 API — all business logic routers
from fastapi import APIRouter as _APIRouter
_v1 = _APIRouter(prefix="/v1")
_v1.include_router(auth.router)
_v1.include_router(users.router)
_v1.include_router(controls.router)
_v1.include_router(test_cycles.router)
_v1.include_router(evidence.router)
_v1.include_router(dashboard.router)
_v1.include_router(deficiencies.router)
_v1.include_router(assets.router)
_v1.include_router(threats.router)
_v1.include_router(risks.router)
_v1.include_router(exports.router)
_v1.include_router(exceptions.router)
_v1.include_router(approvals.router)
_v1.include_router(risk_reviews.router)
_v1.include_router(treatment_plans.router)
_v1.include_router(audit_logs.router)
_v1.include_router(notifications.router)
_v1.include_router(checklist.router)
_v1.include_router(deficiency_milestones.router)
_v1.include_router(deficiency_milestones.escalation_router)
_v1.include_router(treatment_escalation_router)
_v1.include_router(my_work.router)
_v1.include_router(telemetry.router)
app.include_router(_v1)
app.include_router(scim.router)



