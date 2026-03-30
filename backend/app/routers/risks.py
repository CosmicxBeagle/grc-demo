from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import RiskCreate, RiskUpdate, RiskOut, RiskControlCreate
from app.services.services import RiskService
from app.auth.permissions import require_permission
from app.models.models import User

router = APIRouter(prefix="/risks", tags=["risks"])


# NOTE: /by-control/{control_id} must be defined BEFORE /{risk_id} to avoid
# FastAPI treating "by-control" as an integer path parameter.
@router.get("/by-control/{control_id}", response_model=list[RiskOut])
def risks_for_control(control_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission("risks:read"))):
    return RiskService(db).get_risks_for_control(control_id)


@router.get("", response_model=list[RiskOut])
def list_risks(db: Session = Depends(get_db), _: User = Depends(require_permission("risks:read"))):
    return RiskService(db).list_all()


@router.get("/{risk_id}", response_model=RiskOut)
def get_risk(risk_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission("risks:read"))):
    return RiskService(db).get(risk_id)


@router.post("", response_model=RiskOut, status_code=201)
def create_risk(data: RiskCreate, db: Session = Depends(get_db), _: User = Depends(require_permission("risks:write"))):
    return RiskService(db).create(data)


@router.patch("/{risk_id}", response_model=RiskOut)
def update_risk(risk_id: int, data: RiskUpdate, db: Session = Depends(get_db), _: User = Depends(require_permission("risks:write"))):
    return RiskService(db).update(risk_id, data)


@router.delete("/{risk_id}", status_code=204)
def delete_risk(risk_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission("risks:write"))):
    RiskService(db).delete(risk_id)


@router.post("/{risk_id}/controls", status_code=201)
def link_control(risk_id: int, data: RiskControlCreate, db: Session = Depends(get_db), _: User = Depends(require_permission("risks:write"))):
    return RiskService(db).add_control(risk_id, data.control_id, data.notes)


@router.delete("/{risk_id}/controls/{control_id}", status_code=204)
def unlink_control(risk_id: int, control_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission("risks:write"))):
    RiskService(db).remove_control(risk_id, control_id)
