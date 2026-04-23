import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import Base, engine
from app.models import models  # noqa: F401 — registers all models with Base
from app.routers import auth, users, controls, test_cycles, evidence, dashboard, deficiencies, assets, threats, risks, exports, exceptions, approvals, risk_reviews, treatment_plans, audit_logs, notifications, checklist, deficiency_milestones, health, my_work, telemetry, scim
from app.middleware.correlation import CorrelationMiddleware
from app.middleware.session_refresh import session_refresh_middleware

# ── Audit logger — structured JSON to stdout ──────────────────────────────────
# Azure Container Apps ships stdout to Azure Monitor automatically.
# To forward to Sentinel / any SIEM: add a Diagnostic Setting in Azure Monitor.
_audit_handler = logging.StreamHandler(sys.stdout)
_audit_handler.setFormatter(logging.Formatter("%(message)s"))  # raw JSON, no extra prefix
logging.getLogger("audit").addHandler(_audit_handler)
logging.getLogger("audit").setLevel(logging.INFO)
logging.getLogger("audit").propagate = False

# ── Schema bootstrap ──────────────────────────────────────────────────────────
# create_all() is a no-op on existing tables — it only creates missing ones
# (safe for fresh installs and test fixtures).
# Alembic then applies any pending incremental migrations, replacing the old
# startup-time ALTER TABLE patch script.
if settings.app_env == 'local' and settings.database_url.startswith('sqlite'):
    Base.metadata.create_all(bind=engine)




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
_v1.include_router(my_work.router)
_v1.include_router(telemetry.router)
app.include_router(_v1)
app.include_router(scim.router)



