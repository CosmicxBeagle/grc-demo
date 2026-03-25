from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import (
    TestCycleCreate, TestCycleUpdate, TestCycleOut, TestCycleSummary,
    TestAssignmentCreate, TestAssignmentUpdate, TestAssignmentOut,
)
from app.models.models import ControlMapping
from app.services.services import TestCycleService, AssignmentService
from app.auth.local_auth import get_current_user, require_role
from app.models.models import User

router = APIRouter(prefix="/test-cycles", tags=["test-cycles"])


@router.get("", response_model=list[TestCycleSummary])
def list_cycles(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return TestCycleService(db).list_cycles()


@router.get("/{cycle_id}", response_model=TestCycleOut)
def get_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return TestCycleService(db).get_cycle(cycle_id)


@router.post("", response_model=TestCycleOut, status_code=201)
def create_cycle(
    data: TestCycleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return TestCycleService(db).create_cycle(data)


@router.patch("/{cycle_id}", response_model=TestCycleOut)
def update_cycle(
    cycle_id: int,
    data: TestCycleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return TestCycleService(db).update_cycle(cycle_id, data)


# ── Assignment sub-routes ──────────────────────────────────────────────────

@router.post("/{cycle_id}/assignments/bulk-framework", status_code=200)
def bulk_add_framework(
    cycle_id: int,
    framework: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Add all controls mapped to a framework that aren't already in the cycle."""
    TestCycleService(db).get_cycle(cycle_id)  # 404 if not found
    control_ids = [
        row[0] for row in
        db.query(ControlMapping.control_id)
        .filter(ControlMapping.framework == framework)
        .distinct()
        .all()
    ]
    from app.repositories.repositories import AssignmentRepository
    added = AssignmentRepository(db).bulk_create(cycle_id, control_ids)
    return {"added": added, "framework": framework}



@router.post("/{cycle_id}/assignments", response_model=TestAssignmentOut, status_code=201)
def add_assignment(
    cycle_id: int,
    data: TestAssignmentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return AssignmentService(db).add_assignment(cycle_id, data)


@router.patch("/{cycle_id}/assignments/{assignment_id}", response_model=TestAssignmentOut)
def update_assignment(
    cycle_id: int,
    assignment_id: int,
    data: TestAssignmentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AssignmentService(db).update_assignment(assignment_id, data)
