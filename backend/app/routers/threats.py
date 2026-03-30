from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import ThreatCreate, ThreatUpdate, ThreatOut
from app.services.services import ThreatService
from app.auth.permissions import require_permission
from app.models.models import User

router = APIRouter(prefix="/threats", tags=["threats"])


@router.get("", response_model=list[ThreatOut])
def list_threats(db: Session = Depends(get_db), _: User = Depends(require_permission("threats:read"))):
    return ThreatService(db).list_all()


@router.post("", response_model=ThreatOut, status_code=201)
def create_threat(data: ThreatCreate, db: Session = Depends(get_db), _: User = Depends(require_permission("threats:write"))):
    return ThreatService(db).create(data)


@router.patch("/{threat_id}", response_model=ThreatOut)
def update_threat(threat_id: int, data: ThreatUpdate, db: Session = Depends(get_db), _: User = Depends(require_permission("threats:write"))):
    return ThreatService(db).update(threat_id, data)


@router.delete("/{threat_id}", status_code=204)
def delete_threat(threat_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission("threats:write"))):
    ThreatService(db).delete(threat_id)
