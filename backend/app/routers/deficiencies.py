from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import DeficiencyCreate, DeficiencyUpdate, DeficiencyOut
from app.services.services import DeficiencyService, AuditService
from app.auth.permissions import require_permission
from app.models.models import User

router = APIRouter(prefix="/deficiencies", tags=["deficiencies"])


def _snap(d) -> dict:
    return {
        "title":            d.title,
        "severity":         d.severity,
        "status":           d.status,
        "remediation_plan": d.remediation_plan,
        "due_date":         str(d.due_date) if d.due_date else None,
    }


@router.get("", response_model=list[DeficiencyOut])
def list_deficiencies(
    status: str = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("deficiencies:read")),
):
    return DeficiencyService(db).list_all(status)


@router.post("", response_model=DeficiencyOut, status_code=201)
def create_deficiency(
    data: DeficiencyCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("deficiencies:write")),
):
    result = DeficiencyService(db).create(data)
    AuditService(db).log(
        "DEFICIENCY_CREATED", actor=current_user,
        resource_type="Deficiency", resource_id=result.id, resource_name=result.title,
        after=_snap(result), request=request,
    )
    return result


@router.patch("/{deficiency_id}", response_model=DeficiencyOut)
def update_deficiency(
    deficiency_id: int,
    data: DeficiencyUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("deficiencies:write")),
):
    svc = DeficiencyService(db)
    existing = svc.get(deficiency_id)
    before = _snap(existing)
    result = svc.update(deficiency_id, data)
    AuditService(db).log(
        "DEFICIENCY_UPDATED", actor=current_user,
        resource_type="Deficiency", resource_id=deficiency_id, resource_name=result.title,
        before=before, after=_snap(result), request=request,
    )
    return result


@router.delete("/{deficiency_id}", status_code=204)
def delete_deficiency(
    deficiency_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("deficiencies:write")),
):
    svc = DeficiencyService(db)
    obj = svc.get(deficiency_id)
    before = _snap(obj)
    name = obj.title
    svc.delete(deficiency_id)
    AuditService(db).log(
        "DEFICIENCY_DELETED", actor=current_user,
        resource_type="Deficiency", resource_id=deficiency_id, resource_name=name,
        before=before, request=request,
    )
