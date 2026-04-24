"""
Milestone escalation service — Loop 3.

Handles escalation and extension workflows for BOTH milestone types:
  - DeficiencyMilestone  (existing — behaviour unchanged)
  - TreatmentMilestone   (new — mirrors deficiency behaviour exactly)

Responsibilities
─────────────────
1. run_milestone_escalations(db)           — daily cron for deficiency milestones
2. run_treatment_milestone_escalations(db) — daily cron for treatment milestones

Escalation levels (shared by both types):
  level 0 → 1 : notify assignee by email + in-app notification
  level 1 → 2 : notify GRC managers; manager action required

3. request_extension(db, milestone, requestor, reason, parent_name)
4. approve_extension(db, milestone, approver, new_due_date, parent_name)
5. reject_extension(db, milestone, approver, parent_name)

All three extension helpers accept any milestone that carries the shared
escalation/extension columns (both DeficiencyMilestone and TreatmentMilestone).
The caller supplies `parent_name` (e.g. the deficiency title or risk title)
so the helpers stay free of model-specific relationship lookups.
"""
from datetime import date, datetime
from typing import Callable, Optional, Union

from sqlalchemy.orm import Session, joinedload

from app.models.models import DeficiencyMilestone, TreatmentMilestone, TreatmentPlan, User
from app.repositories.repositories import NotificationRepository
from app.services.email_service import send_email

# Union type accepted by the extension helpers
AnyMilestone = Union[DeficiencyMilestone, TreatmentMilestone]


def _grc_managers(db: Session) -> list[User]:
    return db.query(User).filter(User.role.in_(["admin", "grc_manager"])).all()


# ── Generic escalation core ───────────────────────────────────────────────────

def _run_escalation_for(
    db: Session,
    milestones: list,
    entity_type: str,
    get_parent_name: Callable,   # milestone → str
    results: dict,
) -> None:
    """
    Apply level 0→1→2 escalation to a pre-filtered list of overdue milestones.
    Mutates `results` in place. Caller must call db.commit() when finished.
    """
    repo     = NotificationRepository(db)
    managers = _grc_managers(db)

    for m in milestones:
        try:
            if m.escalation_level == 0:
                _escalate_to_level_1(m, repo, entity_type, get_parent_name(m))
                results["level_1_escalations"] += 1
            elif m.escalation_level == 1:
                _escalate_to_level_2(m, repo, managers, entity_type, get_parent_name(m))
                results["level_2_escalations"] += 1
            # level 2 is the ceiling; already max-escalated milestones are left alone
        except Exception as exc:
            results["errors"].append(f"{entity_type} milestone {m.id}: {exc}")


def _escalate_to_level_1(
    milestone: AnyMilestone,
    repo: NotificationRepository,
    entity_type: str,
    parent_name: str,
) -> None:
    """Notify the milestone assignee that their milestone is overdue."""
    milestone.escalation_level = 1
    milestone.escalated_at     = datetime.utcnow()
    milestone.status           = "overdue"

    message = (
        f"Milestone '{milestone.title}' for {parent_name} is overdue "
        f"(due {milestone.due_date}). Please complete or request an extension."
    )
    if milestone.assignee:
        repo.create(
            user_id=milestone.assignee_id,
            message=message,
            entity_type=entity_type,
            entity_id=milestone.id,
        )
        if milestone.assignee.email:
            send_email(
                milestone.assignee.email,
                f"[GRC] Overdue Milestone: {milestone.title}",
                f"""
                <h2 style="color:#b45309">Milestone Overdue</h2>
                <p>Your milestone <strong>{milestone.title}</strong> for
                <strong>{parent_name}</strong> was due on
                <strong>{milestone.due_date}</strong> and has not been completed.</p>
                <p>Please complete the milestone or request an extension as soon as possible.</p>
                """,
            )


def _escalate_to_level_2(
    milestone: AnyMilestone,
    repo: NotificationRepository,
    managers: list[User],
    entity_type: str,
    parent_name: str,
) -> None:
    """Escalate to GRC managers when the assignee hasn't acted after level-1."""
    milestone.escalation_level = 2
    milestone.escalated_at     = datetime.utcnow()

    assignee_name = milestone.assignee.display_name if milestone.assignee else "Unassigned"
    message = (
        f"ESCALATED: Milestone '{milestone.title}' for {parent_name} "
        f"remains overdue (due {milestone.due_date}). Assignee: {assignee_name}."
    )
    for mgr in managers:
        repo.create(
            user_id=mgr.id,
            message=message,
            entity_type=entity_type,
            entity_id=milestone.id,
        )
        if mgr.email:
            send_email(
                mgr.email,
                f"[GRC Alert] Escalated Overdue Milestone: {milestone.title}",
                f"""
                <h2 style="color:#b91c1c">Milestone Escalation — Manager Action Required</h2>
                <p>Milestone <strong>{milestone.title}</strong> for
                <strong>{parent_name}</strong> is still overdue after initial notification.</p>
                <table style="border-collapse:collapse;width:100%">
                  <tr><td style="padding:4px 8px"><strong>Due date</strong></td>
                      <td>{milestone.due_date}</td></tr>
                  <tr><td style="padding:4px 8px"><strong>Assignee</strong></td>
                      <td>{assignee_name}</td></tr>
                  <tr><td style="padding:4px 8px"><strong>Escalation level</strong></td>
                      <td>2 (manager)</td></tr>
                </table>
                <p>Please review this milestone and take appropriate action.</p>
                """,
            )


# ── Public cron-trigger functions ─────────────────────────────────────────────

def run_milestone_escalations(db: Session) -> dict:
    """
    Deficiency milestones — called by the existing
    POST /deficiency-milestones/run-escalations cron endpoint.
    Behaviour is identical to pre-refactor.
    """
    today   = date.today()
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

    def _def_name(m):
        return m.deficiency.title if m.deficiency else f"Deficiency #{m.deficiency_id}"

    _run_escalation_for(db, overdue, "deficiency_milestone", _def_name, results)
    db.commit()
    return results


def run_treatment_milestone_escalations(db: Session) -> dict:
    """
    Treatment-plan milestones — called by the new
    POST /treatment-milestones/run-escalations cron endpoint.
    """
    today   = date.today()
    results = {"level_1_escalations": 0, "level_2_escalations": 0, "errors": []}

    overdue = (
        db.query(TreatmentMilestone)
        .options(
            joinedload(TreatmentMilestone.assigned_to),
            joinedload(TreatmentMilestone.plan).joinedload(TreatmentPlan.risk),
        )
        .filter(
            TreatmentMilestone.due_date < today,
            TreatmentMilestone.status.notin_(["completed"]),
        )
        .all()
    )

    def _plan_name(m):
        if m.plan and m.plan.risk:
            return f"Treatment Plan (Risk: {m.plan.risk.title})"
        return f"Treatment Plan #{m.plan_id}"

    _run_escalation_for(db, overdue, "treatment_milestone", _plan_name, results)
    db.commit()
    return results


# ── Extension request / approve / reject ─────────────────────────────────────
# These helpers work with any milestone that carries the shared extension columns.
# Caller is responsible for loading the milestone with its relationships and for
# committing the session after the call.

def request_extension(
    db: Session,
    milestone: AnyMilestone,
    requestor: User,
    reason: str,
    parent_name: Optional[str] = None,
) -> AnyMilestone:
    """
    Record an extension request on the milestone.
    Sets extension_requested=True, saves the reason, preserves original_due_date.
    Notifies GRC managers. Does NOT commit — caller must commit.
    """
    if milestone.extension_requested and milestone.extension_approved is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="An extension request is already pending")

    # Derive parent name for notification text if not supplied
    if parent_name is None:
        parent_name = _resolve_parent_name(milestone)

    # Preserve original due date on first extension
    if milestone.original_due_date is None:
        milestone.original_due_date = milestone.due_date

    milestone.extension_requested        = True
    milestone.extension_request_reason   = reason
    milestone.extension_requested_at     = datetime.utcnow()
    milestone.extension_approved         = None  # pending

    message = (
        f"{requestor.display_name} requested a due-date extension for milestone "
        f"'{milestone.title}' ({parent_name}). Reason: {reason}"
    )
    managers = _grc_managers(db)
    repo     = NotificationRepository(db)
    entity_type = _entity_type(milestone)

    for mgr in managers:
        repo.create(
            user_id=mgr.id,
            message=message,
            entity_type=entity_type,
            entity_id=milestone.id,
        )
        if mgr.email:
            send_email(
                mgr.email,
                f"[GRC] Extension Request: {milestone.title}",
                f"""
                <h2>Milestone Extension Request</h2>
                <p><strong>{requestor.display_name}</strong> has requested an extension for
                milestone <strong>{milestone.title}</strong> ({parent_name}).</p>
                <table style="border-collapse:collapse;width:100%">
                  <tr><td style="padding:4px 8px"><strong>Current due date</strong></td>
                      <td>{milestone.due_date}</td></tr>
                  <tr><td style="padding:4px 8px"><strong>Reason</strong></td>
                      <td>{reason}</td></tr>
                </table>
                <p>Please approve or reject this extension request in the GRC platform.</p>
                """,
            )
    return milestone


def approve_extension(
    db: Session,
    milestone: AnyMilestone,
    approver: User,
    new_due_date: date,
    parent_name: Optional[str] = None,
) -> AnyMilestone:
    """
    Approve a pending extension and set the new due date.
    Does NOT commit — caller must commit.
    """
    if not milestone.extension_requested or milestone.extension_approved is not None:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No pending extension request on this milestone")

    if parent_name is None:
        parent_name = _resolve_parent_name(milestone)

    milestone.extension_approved            = True
    milestone.extension_approved_by_user_id = approver.id
    milestone.new_due_date                  = new_due_date
    milestone.due_date                      = new_due_date  # update the active due date

    # Reset escalation so the milestone gets a fresh run on the new due date
    if milestone.status == "overdue":
        milestone.status          = "open"
        milestone.escalation_level = 0

    repo = NotificationRepository(db)
    if milestone.assignee_id:
        repo.create(
            user_id=milestone.assignee_id,
            message=(
                f"Your extension request for milestone '{milestone.title}' ({parent_name}) "
                f"was approved. New due date: {new_due_date}."
            ),
            entity_type=_entity_type(milestone),
            entity_id=milestone.id,
        )
    return milestone


def reject_extension(
    db: Session,
    milestone: AnyMilestone,
    approver: User,
    parent_name: Optional[str] = None,
) -> AnyMilestone:
    """
    Reject a pending extension request.
    Does NOT commit — caller must commit.
    """
    if not milestone.extension_requested or milestone.extension_approved is not None:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No pending extension request on this milestone")

    if parent_name is None:
        parent_name = _resolve_parent_name(milestone)

    milestone.extension_approved            = False
    milestone.extension_approved_by_user_id = approver.id

    repo = NotificationRepository(db)
    if milestone.assignee_id:
        repo.create(
            user_id=milestone.assignee_id,
            message=(
                f"Your extension request for milestone '{milestone.title}' ({parent_name}) "
                f"was rejected. Original due date {milestone.due_date} stands."
            ),
            entity_type=_entity_type(milestone),
            entity_id=milestone.id,
        )
    return milestone


# ── Internal helpers ──────────────────────────────────────────────────────────

def _entity_type(milestone: AnyMilestone) -> str:
    return (
        "deficiency_milestone"
        if isinstance(milestone, DeficiencyMilestone)
        else "treatment_milestone"
    )


def _resolve_parent_name(milestone: AnyMilestone) -> str:
    """Fallback parent-name resolution when the caller doesn't supply one."""
    if isinstance(milestone, DeficiencyMilestone):
        return (
            milestone.deficiency.title
            if milestone.deficiency
            else f"Deficiency #{milestone.deficiency_id}"
        )
    # TreatmentMilestone
    if milestone.plan and milestone.plan.risk:
        return f"Treatment Plan (Risk: {milestone.plan.risk.title})"
    return f"Treatment Plan #{milestone.plan_id}"
