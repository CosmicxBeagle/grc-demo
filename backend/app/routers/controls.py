from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import ControlCreate, ControlUpdate, ControlOut, ControlCycleHistoryOut
from app.services.services import ControlService
from app.services import audit_service
from app.auth.permissions import require_permission, has_permission
from app.models.models import User

router = APIRouter(prefix="/controls", tags=["controls"])


def _snap(c) -> dict:
    return {
        "control_id":     c.control_id,
        "title":          c.title,
        "control_type":   c.control_type,
        "frequency":      c.frequency,
        "owner":          c.owner,
        "status":         c.status,
        "sox_in_scope":   c.sox_in_scope,
        "sox_itgc_domain":c.sox_itgc_domain,
    }


@router.get("", response_model=list[ControlOut])
def list_controls(
    status: str = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("controls:read")),
):
    return ControlService(db).list_controls(status)


@router.get("/{control_id}", response_model=ControlOut)
def get_control(
    control_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("controls:read")),
):
    return ControlService(db).get_control(control_id)


@router.get("/{control_id}/cycles", response_model=list[ControlCycleHistoryOut])
def get_control_cycles(
    control_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("controls:read")),
):
    ctrl = ControlService(db).get_control(control_id)
    from sqlalchemy.orm import joinedload
    from app.models.models import TestAssignment, TestCycle
    assignments = (
        db.query(TestAssignment)
        .options(
            joinedload(TestAssignment.test_cycle),
            joinedload(TestAssignment.tester),
            joinedload(TestAssignment.reviewer),
            joinedload(TestAssignment.evidence),
        )
        .filter(TestAssignment.control_id == ctrl.id)
        .order_by(TestAssignment.created_at.desc())
        .all()
    )
    return [
        {
            "cycle_id":           a.test_cycle.id,
            "cycle_name":         a.test_cycle.name,
            "cycle_status":       a.test_cycle.status,
            "start_date":         a.test_cycle.start_date,
            "end_date":           a.test_cycle.end_date,
            "assignment_id":      a.id,
            "assignment_status":  a.status,
            "tester":             a.tester,
            "reviewer":           a.reviewer,
            "tester_notes":       a.tester_notes,
            "reviewer_comments":  a.reviewer_comments,
            "evidence_count":     len(a.evidence),
        }
        for a in assignments
    ]


@router.post("", response_model=ControlOut, status_code=201)
def create_control(
    data: ControlCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("controls:write")),
):
    # Mappings require an extra privilege
    if data.mappings and not has_permission(current_user.role, "controls:manage_mappings"):
        raise HTTPException(status_code=403, detail="Only admins can set framework mappings")
    result = ControlService(db).create_control(data)
    audit_service.emit(db,
        "CONTROL_CREATED", actor=current_user,
        resource_type="Control", resource_id=result.id,
        resource_name=f"{result.control_id} — {result.title}",
        after=_snap(result), request=request,
    )
    return result


@router.patch("/{control_id}", response_model=ControlOut)
def update_control(
    control_id: int,
    data: ControlUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("controls:write")),
):
    # Mappings (including clearing them with []) require admin
    if data.mappings is not None and not has_permission(current_user.role, "controls:manage_mappings"):
        raise HTTPException(status_code=403, detail="Only admins can modify framework mappings")
    svc = ControlService(db)
    before_obj = svc.get_control(control_id)
    before = _snap(before_obj)
    result = svc.update_control(control_id, data)
    audit_service.emit(db,
        "CONTROL_UPDATED", actor=current_user,
        resource_type="Control", resource_id=result.id,
        resource_name=f"{result.control_id} — {result.title}",
        before=before, after=_snap(result), request=request,
    )
    return result


@router.delete("/{control_id}", status_code=204)
def delete_control(
    control_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("controls:delete")),
):
    svc = ControlService(db)
    obj = svc.get_control(control_id)
    before = _snap(obj)
    name = f"{obj.control_id} — {obj.title}"
    svc.delete_control(control_id)
    audit_service.emit(db,
        "CONTROL_DELETED", actor=current_user,
        resource_type="Control", resource_id=control_id,
        resource_name=name, before=before, request=request,
    )
