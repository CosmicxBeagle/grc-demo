"""
Evidence reopen service — Loop 2.

Handles reopening a fulfilled evidence request on a TestAssignment:
- requires a non-empty reason (min 10 chars)
- increments reopen_count and logs the history entry
- notifies GRC managers if reopen_count >= 2
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.models import (
    EvidenceRequestHistory,
    Notification,
    TestAssignment,
    User,
)
from app.repositories.repositories import NotificationRepository
from app.services.email_service import send_email


REOPEN_ESCALATION_THRESHOLD = 2


def _grc_managers(db: Session) -> list[User]:
    return db.query(User).filter(User.role.in_(["admin", "grc_manager"])).all()


def process_evidence_reopen(
    db: Session,
    assignment: TestAssignment,
    actor: User,
    reason: str,
) -> TestAssignment:
    """
    Record an evidence-request reopen, escalate if threshold is reached.
    The caller is responsible for committing after this call.
    """
    now = datetime.utcnow()

    new_count = (assignment.reopen_count or 0) + 1
    assignment.reopen_count = new_count
    assignment.last_reopened_at = now
    assignment.last_reopen_reason = reason

    history_entry = EvidenceRequestHistory(
        assignment_id=assignment.id,
        action="reopened",
        actor_user_id=actor.id,
        reason=reason,
        occurred_at=now,
    )
    db.add(history_entry)

    if new_count >= REOPEN_ESCALATION_THRESHOLD:
        _escalate_reopen(db, assignment, actor, reason, new_count)

    return assignment


def record_evidence_history(
    db: Session,
    assignment_id: int,
    action: str,
    actor_user_id: int | None = None,
    reason: str | None = None,
    file_snapshot_reference: str | None = None,
) -> EvidenceRequestHistory:
    """
    Write a single EvidenceRequestHistory row for any action
    (opened | fulfilled | reopened | cancelled).
    Does NOT commit — caller must commit.
    """
    entry = EvidenceRequestHistory(
        assignment_id=assignment_id,
        action=action,
        actor_user_id=actor_user_id,
        reason=reason,
        file_snapshot_reference=file_snapshot_reference,
        occurred_at=datetime.utcnow(),
    )
    db.add(entry)
    return entry


def _escalate_reopen(
    db: Session,
    assignment: TestAssignment,
    actor: User,
    reason: str,
    reopen_count: int,
) -> None:
    control_name = assignment.control.title if assignment.control else f"Control #{assignment.control_id}"
    tester_name = assignment.tester.display_name if assignment.tester else "Unknown Tester"
    actor_name = actor.display_name

    message = (
        f"Evidence request for Assignment #{assignment.id} ({control_name}) has been reopened "
        f"{reopen_count} time(s). Tester: {tester_name}. Actor: {actor_name}. "
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
            subject = f"[GRC Alert] Evidence request reopened {reopen_count}x — {control_name}"
            body = f"""
            <h2 style="color:#b91c1c">Repeated Evidence Reopen Escalation</h2>
            <p>The evidence request for Assignment <strong>#{assignment.id}</strong>
            (control <strong>{control_name}</strong>) has been reopened
            <strong>{reopen_count} time(s)</strong>.</p>
            <table style="border-collapse:collapse;width:100%">
              <tr><td style="padding:4px 8px"><strong>Tester</strong></td><td>{tester_name}</td></tr>
              <tr><td style="padding:4px 8px"><strong>Reopened by</strong></td><td>{actor_name}</td></tr>
              <tr><td style="padding:4px 8px"><strong>Latest reopen reason</strong></td><td>{reason}</td></tr>
              <tr><td style="padding:4px 8px"><strong>Reopen count</strong></td><td>{reopen_count}</td></tr>
            </table>
            <p>Please review this assignment and take appropriate action.</p>
            """
            send_email(mgr.email, subject, body)
