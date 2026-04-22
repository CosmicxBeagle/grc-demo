from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import DashboardStats
from app.services.services import DashboardService
from app.auth.permissions import require_permission
from app.models.models import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:read")),
):
    return DashboardService(db).get_stats()
