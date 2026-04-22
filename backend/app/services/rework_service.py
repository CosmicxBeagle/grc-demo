"""
Rework escalation service — Loop 1.

Handles the logic for returning a test assignment for rework:
- requires a non-empty reason (min 10 chars)
- increments rework_count and logs the return
- notifies GRC managers if rework_count >= 3
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.models import (
    AssignmentReworkLog,
    Notification,
    TestAssignment,
    User,
)
from app.repositories.repositories import NotificationRepository
from app.services.email_service import send_email


REWORK_ESCALATION_THRESHOLD = 3


def _grc_managers(db: Session) -> list[User]:
    return db.query(User).filter(User.role.in_(["admin", "grc_manager"])).all()


def process_return_for_rework(
    db: Session,
    assignment: TestAssignment,
    reviewer: User,
    reason: str,
) -> TestAssignment:
    """
    Record a rework return, escalate if threshold is reached.
    The caller is responsible for committing the assignment status change AFTER this call.
    """
    now = datetime.utcnow()

    # Increment counters on assignment
    new_count = (assignment.rework_count or 0) + 1
    assignment.rework_count = new_count
    assignment.last_returned_at = now
    assignment.last_return_reason = reason

    # Write immutable log entry
    log_entry = AssignmentReworkLog(
        assignment_id=assignment.id,
        returned_by_user_id=reviewer.id,
        return_reason=reason,
        returned_at=now,
        rework_number=new_count,
    )
    db.add(log_entry)

    # Escalate when threshold reached
    if new_count >= REWORK_ESCALATION_THRESHOLD:
        _escalate_rework(db, assignment, reviewer, reason, new_count)

    return assignment


def _escalate_rework(
    db: Session,
    assignment: TestAssignment,
    reviewer: User,
    reason: str,
    rework_count: int,
) -> None:
    control_name = assignment.control.title if assignment.control else f"Control #{assignment.control_id}"
    tester_name = assignment.tester.display_name if assignment.tester else "Unknown Tester"
    reviewer_name = reviewer.display_name

    message = (
        f"Assignment #{assignment.id} ({control_name}) has been returned for rework "
        f"{rework_count} time(s). Tester: {tester_name}. Reviewer: {reviewer_name}. "
        f"Latest reason: {reason}"
    )

    managers = _grc_managers(db)
    repo = NotificationRepository(db)
    for mgr in managers:
        repo.create(
            user_id=mgr.id,
            message=message,
            entity_type="assignment",
            entity_id=assignment.id,
        )
        if mgr.email:
            subject = f"[GRC Alert] Assignment returned {rework_count}x — {control_name}"
            body = f"""
            <h2 style="color:#b91c1c">Repeated Rework Escalation</h2>
            <p>Assignment <strong>#{assignment.id}</strong> for control
            <strong>{control_name}</strong> has been returned for rework
            <strong>{rework_count} time(s)</strong>.</p>
            <table style="border-collapse:collapse;width:100%">
              <tr><td style="padding:4px 8px"><strong>Tester</strong></td><td>{tester_name}</td></tr>
              <tr><td style="padding:4px 8px"><strong>Reviewer</strong></td><td>{reviewer_name}</td></tr>
              <tr><td style="padding:4px 8px"><strong>Latest return reason</strong></td><td>{reason}</td></tr>
              <tr><td style="padding:4px 8px"><strong>Rework count</strong></td><td>{rework_count}</td></tr>
            </table>
            <p>Please review this assignment and take appropriate action.</p>
            """
            send_email(mgr.email, subject, body)
