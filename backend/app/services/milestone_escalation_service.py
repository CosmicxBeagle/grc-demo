"""
Milestone escalation service — Loop 3.

Two responsibilities:
1. run_milestone_escalations(db) — designed to be called by a daily cron job.
   Finds overdue milestones and bumps their escalation_level:
     level 0 → 1: notify milestone assignee (owner)
     level 1 → 2: notify GRC managers

2. Extension request helpers:
   - request_extension(db, milestone, requestor, reason)
   - approve_extension(db, milestone, approver, new_due_date)
   - reject_extension(db, milestone, approver)
"""
from datetime import date, datetime

from sqlalchemy.orm import Session, joinedload

from app.models.models import DeficiencyMilestone, User
from app.repositories.repositories import NotificationRepository
from app.services.email_service import send_email


def _grc_managers(db: Session) -> list[User]:
    return db.query(User).filter(User.role.in_(["admin", "grc_manager"])).all()


# ── Cron-triggered escalation ────────────────────────────────────────────────

def run_milestone_escalations(db: Session) -> dict:
    """
    Scan overdue open milestones and escalate as needed.
    Returns a summary dict with counts of actions taken.
    """
    today = date.today()
    results = {"level_1_escalations": 0, "level_2_escalations": 0, "errors": []}

    overdue = (
        db.query(DeficiencyMilestone)
        .options(
            joinedload(DeficiencyMilestone.assignee),
            joinedload(DeficiencyMilestone.deficiency),
        )
        .filter(
            DeficiencyMilestone.due_date < today,
            DeficiencyMilestone.status.notin_(["completed"]),
        )
        .all()
    )

    repo = NotificationRepository(db)
    managers = _grc_managers(db)

    for m in overdue:
        try:
            if m.escalation_level == 0:
                _escalate_to_level_1(db, m, repo)
                results["level_1_escalations"] += 1
            elif m.escalation_level == 1:
                _escalate_to_level_2(db, m, repo, managers)
                results["level_2_escalations"] += 1
            # level 2 is the ceiling; already max-escalated milestones are left alone
        except Exception as exc:
            results["errors"].append(f"Milestone {m.id}: {exc}")

    db.commit()
    return results


def _escalate_to_level_1(
    db: Session,
    milestone: DeficiencyMilestone,
    repo: NotificationRepository,
) -> None:
    """Notify the milestone assignee that their milestone is overdue."""
    now = datetime.utcnow()
    milestone.escalation_level = 1
    milestone.escalated_at = now
    milestone.status = "overdue"

    deficiency_name = milestone.deficiency.title if milestone.deficiency else f"Deficiency #{milestone.deficiency_id}"
    message = (
        f"Milestone '{milestone.title}' for deficiency '{deficiency_name}' is overdue "
        f"(due {milestone.due_date}). Please complete or request an extension."
    )

    if milestone.assignee:
        repo.create(
            user_id=milestone.assignee_id,
            message=message,
            entity_type="deficiency_milestone",
            entity_id=milestone.id,
        )
        if milestone.assignee.email:
            send_email(
                milestone.assignee.email,
                f"[GRC] Overdue Milestone: {milestone.title}",
                f"""
                <h2 style="color:#b45309">Milestone Overdue</h2>
                <p>Your milestone <strong>{milestone.title}</strong> for deficiency
                <strong>{deficiency_name}</strong> was due on
                <strong>{milestone.due_date}</strong> and has not been completed.</p>
                <p>Please complete the milestone or request an extension as soon as possible.</p>
                """,
            )


def _escalate_to_level_2(
    db: Session,
    milestone: DeficiencyMilestone,
    repo: NotificationRepository,
    managers: list[User],
) -> None:
    """Escalate to GRC managers when the assignee hasn't acted after level-1 escalation."""
    now = datetime.utcnow()
    milestone.escalation_level = 2
    milestone.escalated_at = now

    deficiency_name = milestone.deficiency.title if milestone.deficiency else f"Deficiency #{milestone.deficiency_id}"
    assignee_name = milestone.assignee.display_name if milestone.assignee else "Unassigned"
    message = (
        f"ESCALATED: Milestone '{milestone.title}' for deficiency '{deficiency_name}' "
        f"remains overdue (due {milestone.due_date}). Assignee: {assignee_name}."
    )

    for mgr in managers:
        repo.create(
            user_id=mgr.id,
            message=message,
            entity_type="deficiency_milestone",
            entity_id=milestone.id,
        )
        if mgr.email:
            send_email(
                mgr.email,
                f"[GRC Alert] Escalated Overdue Milestone: {milestone.title}",
                f"""
                <h2 style="color:#b91c1c">Milestone Escalation — Manager Action Required</h2>
                <p>Milestone <strong>{milestone.title}</strong> for deficiency
                <strong>{deficiency_name}</strong> is still overdue after initial notification.</p>
                <table style="border-collapse:collapse;width:100%">
                  <tr><td style="padding:4px 8px"><strong>Due date</strong></td><td>{milestone.due_date}</td></tr>
                  <tr><td style="padding:4px 8px"><strong>Assignee</strong></td><td>{assignee_name}</td></tr>
                  <tr><td style="padding:4px 8px"><strong>Escalation level</strong></td><td>2 (manager)</td></tr>
                </table>
                <p>Please review this milestone and take appropriate action.</p>
                """,
            )


# ── Extension request / approve / reject ─────────────────────────────────────

def request_extension(
    db: Session,
    milestone: DeficiencyMilestone,
    requestor: User,
    reason: str,
) -> DeficiencyMilestone:
    """
    Record an extension request on the milestone.
    Sets extension_requested=True, saves the reason, preserves original_due_date.
    Notifies GRC managers.
    Does NOT commit — caller must commit.
    """
    now = datetime.utcnow()

    if milestone.extension_requested and milestone.extension_approved is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="An extension request is already pending")

    # Preserve the original due date on the first extension
    if milestone.original_due_date is None:
        milestone.original_due_date = milestone.due_date

    milestone.extension_requested = True
    milestone.extension_request_reason = reason
    milestone.extension_requested_at = now
    milestone.extension_approved = None  # pending

    deficiency_name = milestone.deficiency.title if milestone.deficiency else f"Deficiency #{milestone.deficiency_id}"
    message = (
        f"{requestor.display_name} requested a due-date extension for milestone "
        f"'{milestone.title}' ({deficiency_name}). Reason: {reason}"
    )

    managers = _grc_managers(db)
    repo = NotificationRepository(db)
    for mgr in managers:
        repo.create(
            user_id=mgr.id,
            message=message,
            entity_type="deficiency_milestone",
            entity_id=milestone.id,
        )
        if mgr.email:
            send_email(
                mgr.email,
                f"[GRC] Extension Request: {milestone.title}",
                f"""
                <h2>Milestone Extension Request</h2>
                <p><strong>{requestor.display_name}</strong> has requested an extension for
                milestone <strong>{milestone.title}</strong> ({deficiency_name}).</p>
                <table style="border-collapse:collapse;width:100%">
                  <tr><td style="padding:4px 8px"><strong>Current due date</strong></td><td>{milestone.due_date}</td></tr>
                  <tr><td style="padding:4px 8px"><strong>Reason</strong></td><td>{reason}</td></tr>
                </table>
                <p>Please approve or reject this extension request in the GRC platform.</p>
                """,
            )

    return milestone


def approve_extension(
    db: Session,
    milestone: DeficiencyMilestone,
    approver: User,
    new_due_date: date,
) -> DeficiencyMilestone:
    """
    Approve a pending extension and set the new due date.
    Does NOT commit — caller must commit.
    """
    if not milestone.extension_requested or milestone.extension_approved is not None:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No pending extension request on this milestone")

    milestone.extension_approved = True
    milestone.extension_approved_by_user_id = approver.id
    milestone.new_due_date = new_due_date
    milestone.due_date = new_due_date  # update the active due date

    # If the milestone was overdue, reset escalation so it gets a fresh run
    if milestone.status == "overdue":
        milestone.status = "open"
        milestone.escalation_level = 0

    repo = NotificationRepository(db)
    if milestone.assignee_id:
        deficiency_name = milestone.deficiency.title if milestone.deficiency else f"Deficiency #{milestone.deficiency_id}"
        repo.create(
            user_id=milestone.assignee_id,
            message=(
                f"Your extension request for milestone '{milestone.title}' ({deficiency_name}) "
                f"was approved. New due date: {new_due_date}."
            ),
            entity_type="deficiency_milestone",
            entity_id=milestone.id,
        )

    return milestone


def reject_extension(
    db: Session,
    milestone: DeficiencyMilestone,
    approver: User,
) -> DeficiencyMilestone:
    """
    Reject a pending extension request.
    Does NOT commit — caller must commit.
    """
    if not milestone.extension_requested or milestone.extension_approved is not None:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No pending extension request on this milestone")

    milestone.extension_approved = False
    milestone.extension_approved_by_user_id = approver.id

    repo = NotificationRepository(db)
    if milestone.assignee_id:
        deficiency_name = milestone.deficiency.title if milestone.deficiency else f"Deficiency #{milestone.deficiency_id}"
        repo.create(
            user_id=milestone.assignee_id,
            message=(
                f"Your extension request for milestone '{milestone.title}' ({deficiency_name}) "
                f"was rejected. Original due date {milestone.due_date} stands."
            ),
            entity_type="deficiency_milestone",
            entity_id=milestone.id,
        )

    return milestone
