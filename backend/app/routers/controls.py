from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import ControlCreate, ControlUpdate, ControlOut, ControlCycleHistoryOut
from app.services.services import ControlService
from app.auth.local_auth import get_current_user, require_role
from app.models.models import User

router = APIRouter(prefix="/controls", tags=["controls"])


@router.get("", response_model=list[ControlOut])
def list_controls(
    status: str = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return ControlService(db).list_controls(status)


@router.get("/{control_id}", response_model=ControlOut)
def get_control(
    control_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return ControlService(db).get_control(control_id)


@router.get("/{control_id}/cycles", response_model=list[ControlCycleHistoryOut])
def get_control_cycles(
    control_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
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
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return ControlService(db).create_control(data)


@router.patch("/{control_id}", response_model=ControlOut)
def update_control(
    control_id: int,
    data: ControlUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return ControlService(db).update_control(control_id, data)


@router.delete("/{control_id}", status_code=204)
def delete_control(
    control_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    ControlService(db).delete_control(control_id)
