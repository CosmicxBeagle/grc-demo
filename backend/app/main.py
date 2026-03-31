import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import Base, engine
from app.models import models  # noqa: F401 — registers all models with Base
from app.routers import auth, users, controls, test_cycles, evidence, dashboard, deficiencies, assets, threats, risks, exports, exceptions, approvals, risk_reviews, treatment_plans, audit_logs

# ── Audit logger — structured JSON to stdout ──────────────────────────────────
# Azure Container Apps ships stdout to Azure Monitor automatically.
# To forward to Sentinel / any SIEM: add a Diagnostic Setting in Azure Monitor.
_audit_handler = logging.StreamHandler(sys.stdout)
_audit_handler.setFormatter(logging.Formatter("%(message)s"))  # raw JSON, no extra prefix
logging.getLogger("audit").addHandler(_audit_handler)
logging.getLogger("audit").setLevel(logging.INFO)
logging.getLogger("audit").propagate = False

# For local SQLite dev: auto-create any missing tables on startup.
# In Docker/production Alembic handles migrations instead.
if settings.database_url.startswith("sqlite"):
    Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    description="GRC Control Testing Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(controls.router)
app.include_router(test_cycles.router)
app.include_router(evidence.router)
app.include_router(dashboard.router)
app.include_router(deficiencies.router)
app.include_router(assets.router)
app.include_router(threats.router)
app.include_router(risks.router)
app.include_router(exports.router)
app.include_router(exceptions.router)
app.include_router(approvals.router)
app.include_router(risk_reviews.router)
app.include_router(treatment_plans.router)
app.include_router(audit_logs.router)


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.app_env}
