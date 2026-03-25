from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import Base, engine
from app.models import models  # noqa: F401 — ensures models are registered before create_all
from app.routers import auth, users, controls, test_cycles, evidence, dashboard, deficiencies, assets, threats, risks, exports

# Create all tables on startup (SQLite / demo only)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    description="GRC Control Testing Demo — local SQLite backend",
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


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.app_env}
