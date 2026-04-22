"""
Retest service — Workstream 4A.

Validates that deficiencies have a passing re-test (or a waiver) before closure.
"""
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.models import Deficiency, TestAssignment, TestCycle, User
from app.repositories.repositories import AssignmentRepository


def assert_can_close(deficiency: Deficiency) -> None:
    """
    Raise 422 if the deficiency requires a re-test that hasn't been done or waived.
    Call this before any status change to 'remediated'.
    """
    if not deficiency.retest_required:
        return
    if deficiency.retest_waived:
        return
    if deficiency.retest_assignment_id is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "A re-test assignment is required before this deficiency can be closed. "
                "Create a re-test assignment or waive the re-test requirement with a documented reason."
            ),
        )
    # Check if the retest assignment has passed
    retest = deficiency.retest_assignment
    if retest and retest.status != "complete":
        raise HTTPException(
            status_code=422,
            detail=(
                f"The re-test assignment (#{retest.id}) has not yet passed "
                f"(current status: {retest.status}). "
                "Complete the re-test or waive the requirement."
            ),
        )


def create_retest_assignment(
    db: Session,
    deficiency: Deficiency,
    cycle_id: int,
    assigned_to_user_id: int,
    created_by: User,
) -> TestAssignment:
    """
    Create a new re-test assignment linked to the deficiency's parent control.
    Links the assignment back to the deficiency as its re-test.
    Does NOT commit — caller must commit.
    """
    # Verify cycle exists
    cycle = db.query(TestCycle).filter(TestCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Test cycle not found")

    # The original assignment gives us the control_id
    original = db.query(TestAssignment).filter(
        TestAssignment.id == deficiency.assignment_id
    ).first()
    if not original:
        raise HTTPException(status_code=404, detail="Original assignment not found for this deficiency")

    now = datetime.utcnow()
    retest = TestAssignment(
        test_cycle_id=cycle_id,
        control_id=original.control_id,
        tester_id=assigned_to_user_id,
        status="not_started",
        is_retest=True,
        retest_for_deficiency_id=deficiency.id,
        rework_count=0,
        reopen_count=0,
        created_at=now,
        updated_at=now,
    )
    db.add(retest)
    db.flush()

    deficiency.retest_assignment_id = retest.id
    return retest


def waive_retest(
    db: Session,
    deficiency: Deficiency,
    reason: str,
    waived_by: User,
) -> Deficiency:
    """
    Waive the re-test requirement with a documented reason.
    Does NOT commit — caller must commit.
    """
    deficiency.retest_waived = True
    deficiency.retest_waived_by_user_id = waived_by.id
    deficiency.retest_waived_reason = reason
    return deficiency
