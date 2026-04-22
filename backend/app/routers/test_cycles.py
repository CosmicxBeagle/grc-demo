from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.database import get_db
from app.schemas.schemas import (
    TestCycleCreate, TestCycleUpdate, TestCycleOut, TestCycleSummary,
    TestAssignmentCreate, TestAssignmentUpdate, TestAssignmentOut,
    TesterSubmitRequest, ReviewerDecideRequest, ReturnAssignmentRequest,
    ReopenEvidenceRequest,
)
from app.models.models import ControlMapping, TestAssignment
from app.services.services import TestCycleService, AssignmentService
from app.auth.permissions import require_permission
from app.models.models import User

router = APIRouter(prefix="/test-cycles", tags=["test-cycles"])


@router.get("", response_model=list[TestCycleSummary])
def list_cycles(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("tests:read")),
):
    return TestCycleService(db).list_cycles()


@router.get("/{cycle_id}", response_model=TestCycleOut)
def get_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("tests:read")),
):
    return TestCycleService(db).get_cycle(cycle_id)


@router.post("", response_model=TestCycleOut, status_code=201)
def create_cycle(
    data: TestCycleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("tests:write")),
):
    return TestCycleService(db).create_cycle(data)


@router.patch("/{cycle_id}", response_model=TestCycleOut)
def update_cycle(
    cycle_id: int,
    data: TestCycleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("tests:write")),
):
    return TestCycleService(db).update_cycle(cycle_id, data)


@router.post("/{cycle_id}/close", response_model=TestCycleOut)
def close_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tests:write")),
):
    from app.services import audit_service
    cycle = TestCycleService(db).close_cycle(cycle_id)
    audit_service.emit(
        db, "TEST_CYCLE_CLOSED",
        actor=current_user,
        resource_type="TestCycle", resource_id=cycle.id,
        resource_name=cycle.name,
        after={"status": "completed"},
    )
    return cycle


# ── Assignment sub-routes ──────────────────────────────────────────────────

@router.post("/{cycle_id}/assignments/bulk-framework", status_code=200)
def bulk_add_framework(
    cycle_id: int,
    framework: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("tests:write")),
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
    _: User = Depends(require_permission("tests:write")),
):
    return AssignmentService(db).add_assignment(cycle_id, data)


@router.patch("/{cycle_id}/assignments/{assignment_id}", response_model=TestAssignmentOut)
def update_assignment(
    cycle_id: int,
    assignment_id: int,
    data: TestAssignmentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("tests:write")),
):
    return AssignmentService(db).update_assignment(assignment_id, data)


# ── Tester: submit for review ─────────────────────────────────────────────

@router.post("/{cycle_id}/assignments/{assignment_id}/submit", response_model=TestAssignmentOut)
def submit_for_review(
    cycle_id: int,
    assignment_id: int,
    data: TesterSubmitRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("tests:submit_for_review")),
):
    a = db.query(TestAssignment).filter(
        TestAssignment.id == assignment_id,
        TestAssignment.test_cycle_id == cycle_id,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if a.status not in ("in_progress", "not_started"):
        raise HTTPException(status_code=400, detail=f"Cannot submit from status '{a.status}'")

    a.status = "needs_review"
    a.tester_submitted_at = datetime.utcnow()
    a.tester_submitted_by_id = user.id
    a.tester_signoff_note = data.signoff_note
    db.commit()
    return AssignmentService(db).get_assignment(assignment_id)


# ── Reviewer: approve / return / fail ────────────────────────────────────

@router.post("/{cycle_id}/assignments/{assignment_id}/decide", response_model=TestAssignmentOut)
def reviewer_decide(
    cycle_id: int,
    assignment_id: int,
    data: ReviewerDecideRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("tests:write")),
):
    if data.outcome not in ("approved", "returned", "failed"):
        raise HTTPException(status_code=400, detail="outcome must be approved, returned, or failed")

    if data.outcome == "returned":
        if not data.return_reason or len(data.return_reason.strip()) < 10:
            raise HTTPException(
                status_code=422,
                detail="return_reason is required and must be at least 10 characters when returning for rework",
            )

    a = db.query(TestAssignment).filter(
        TestAssignment.id == assignment_id,
        TestAssignment.test_cycle_id == cycle_id,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if a.status != "needs_review":
        raise HTTPException(status_code=400, detail=f"Assignment is not in needs_review status (currently '{a.status}')")

    a.reviewer_decided_at = datetime.utcnow()
    a.reviewer_decided_by_id = user.id
    a.reviewer_outcome = data.outcome
    a.reviewer_comments = data.notes or a.reviewer_comments

    if data.outcome == "approved":
        a.status = "complete"
    elif data.outcome == "returned":
        a.status = "in_progress"
        from app.services.rework_service import process_return_for_rework
        process_return_for_rework(db, a, user, data.return_reason.strip())
    elif data.outcome == "failed":
        a.status = "failed"

    db.commit()
    return AssignmentService(db).get_assignment(assignment_id)


# ── Reviewer: reopen evidence request ────────────────────────────────────────

@router.post("/{cycle_id}/assignments/{assignment_id}/reopen-evidence", response_model=TestAssignmentOut)
def reopen_evidence_request(
    cycle_id: int,
    assignment_id: int,
    data: ReopenEvidenceRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("tests:write")),
):
    """
    Reopen an evidence request on an assignment (e.g. submitted evidence was insufficient).
    Records history, increments reopen_count, escalates to managers at >= 2 reopens.
    """
    a = db.query(TestAssignment).filter(
        TestAssignment.id == assignment_id,
        TestAssignment.test_cycle_id == cycle_id,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    from app.services.evidence_reopen_service import process_evidence_reopen
    process_evidence_reopen(db, a, user, data.reason.strip())
    db.commit()
    return AssignmentService(db).get_assignment(assignment_id)
