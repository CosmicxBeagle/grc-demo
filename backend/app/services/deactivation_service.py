"""
User deactivation service — Workstream 5A.

Before deactivating: check for open work, require reassignment if found.
Soft-delete only — historical records remain.
"""
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.models import (
    User, TestAssignment, DeficiencyMilestone, RiskReviewRequest,
)


def get_open_work_summary(db: Session, user_id: int) -> dict:
    """Return a summary of all open work owned by the user."""
    open_assignments = (
        db.query(TestAssignment)
        .filter(
            TestAssignment.tester_id == user_id,
            TestAssignment.status.notin_(["complete", "failed"]),
        )
        .count()
    )
    open_milestones = (
        db.query(DeficiencyMilestone)
        .filter(
            DeficiencyMilestone.assignee_id == user_id,
            DeficiencyMilestone.status.notin_(["completed"]),
        )
        .count()
    )
    pending_reviews = (
        db.query(RiskReviewRequest)
        .filter(
            RiskReviewRequest.owner_id == user_id,
            RiskReviewRequest.status == "pending",
        )
        .count()
    )
    return {
        "open_assignments": open_assignments,
        "open_milestones": open_milestones,
        "pending_risk_reviews": pending_reviews,
        "total": open_assignments + open_milestones + pending_reviews,
    }


def bulk_reassign(db: Session, from_user_id: int, to_user_id: int) -> dict:
    """Reassign all open work from one user to another. Does NOT commit."""
    # Verify target exists and is active
    target = db.query(User).filter(User.id == to_user_id, User.deactivated_at.is_(None)).first()
    if not target:
        raise HTTPException(status_code=404, detail="Reassignment target user not found or is deactivated")

    reassigned = {"assignments": 0, "milestones": 0, "risk_reviews": 0}

    for a in db.query(TestAssignment).filter(
        TestAssignment.tester_id == from_user_id,
        TestAssignment.status.notin_(["complete", "failed"]),
    ).all():
        a.tester_id = to_user_id
        reassigned["assignments"] += 1

    for m in db.query(DeficiencyMilestone).filter(
        DeficiencyMilestone.assignee_id == from_user_id,
        DeficiencyMilestone.status.notin_(["completed"]),
    ).all():
        m.assignee_id = to_user_id
        reassigned["milestones"] += 1

    for rr in db.query(RiskReviewRequest).filter(
        RiskReviewRequest.owner_id == from_user_id,
        RiskReviewRequest.status == "pending",
    ).all():
        rr.owner_id = to_user_id
        reassigned["risk_reviews"] += 1

    return reassigned


def deactivate_user(
    db: Session,
    target_user: User,
    deactivated_by: User,
    reason: str,
    reassign_to_user_id: int | None = None,
) -> dict:
    """
    Deactivate a user. If they have open work and no reassignment target,
    raises 422. Returns summary of what was reassigned.
    """
    summary = get_open_work_summary(db, target_user.id)
    reassigned = {}

    if summary["total"] > 0:
        if reassign_to_user_id is None:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "User has open work. Provide reassign_to_user_id to proceed.",
                    "open_work": summary,
                },
            )
        reassigned = bulk_reassign(db, target_user.id, reassign_to_user_id)

    # Soft-delete
    target_user.deactivated_at = datetime.utcnow()
    target_user.deactivated_by_user_id = deactivated_by.id
    target_user.deactivation_reason = reason
    target_user.status = "inactive"

    return {"deactivated": True, "reassigned": reassigned, "open_work_summary": summary}
