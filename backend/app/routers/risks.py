from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import RiskCreate, RiskUpdate, RiskOut, RiskControlCreate
from app.services.services import RiskService, AuditService
from app.auth.permissions import require_permission
from app.models.models import User

router = APIRouter(prefix="/risks", tags=["risks"])


def _snap(r) -> dict:
    """Auditable snapshot of a Risk ORM object — only mutable business fields."""
    return {
        "name":                 r.name,
        "description":         r.description,
        "likelihood":          r.likelihood,
        "impact":              r.impact,
        "residual_likelihood": r.residual_likelihood,
        "residual_impact":     r.residual_impact,
        "status":              r.status,
        "treatment":           r.treatment,
        "owner":               r.owner,
        "owner_id":            r.owner_id,
        "asset_id":            r.asset_id,
        "threat_id":           r.threat_id,
    }


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
def create_risk(
    data: RiskCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    result = RiskService(db).create(data)
    AuditService(db).log(
        "RISK_CREATED", actor=current_user,
        resource_type="Risk", resource_id=result.id, resource_name=result.name,
        after=_snap(result), request=request,
    )
    return result


@router.patch("/{risk_id}", response_model=RiskOut)
def update_risk(
    risk_id: int,
    data: RiskUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    svc = RiskService(db)
    before_obj = svc.get(risk_id)
    before = _snap(before_obj)
    result = svc.update(risk_id, data)
    AuditService(db).log(
        "RISK_UPDATED", actor=current_user,
        resource_type="Risk", resource_id=result.id, resource_name=result.name,
        before=before, after=_snap(result), request=request,
    )
    return result


@router.delete("/{risk_id}", status_code=204)
def delete_risk(
    risk_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    svc = RiskService(db)
    obj = svc.get(risk_id)
    before = _snap(obj)
    name = obj.name
    svc.delete(risk_id)
    AuditService(db).log(
        "RISK_DELETED", actor=current_user,
        resource_type="Risk", resource_id=risk_id, resource_name=name,
        before=before, request=request,
    )


@router.post("/{risk_id}/controls", status_code=201)
def link_control(
    risk_id: int,
    data: RiskControlCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    result = RiskService(db).add_control(risk_id, data.control_id, data.notes)
    AuditService(db).log(
        "RISK_CONTROL_LINKED", actor=current_user,
        resource_type="Risk", resource_id=risk_id,
        after={"control_id": data.control_id}, request=request,
    )
    return result


@router.delete("/{risk_id}/controls/{control_id}", status_code=204)
def unlink_control(
    risk_id: int,
    control_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    RiskService(db).remove_control(risk_id, control_id)
    AuditService(db).log(
        "RISK_CONTROL_UNLINKED", actor=current_user,
        resource_type="Risk", resource_id=risk_id,
        before={"control_id": control_id}, request=request,
    )
