"""
Notification endpoints — overdue milestones and expiring exceptions.

POST /notifications/send-reminders
  Scans for:
    • Treatment plan milestones that are past due and not completed → emails assignee
    • Approved exceptions expiring within 30 days → emails the requester

  Designed to be called by a scheduled job (Azure Logic App, cron, etc.) daily.
  Returns a summary of how many emails were sent.
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.auth.local_auth import get_current_user
from app.auth.permissions import require_permission, require_any_permission
from app.models.models import User, TreatmentMilestone, TreatmentPlan, ControlException
from app.repositories.repositories import NotificationRepository
from app.schemas.schemas import NotificationOut
from app.services.email_service import (
    send_email,
    build_milestone_overdue_email,
    build_exception_expiring_email,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/me", response_model=list[NotificationOut])
def get_my_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission(
        "users:read",
        "tests:read",
        "risks:read",
        "approvals:read",
        "exceptions:read",
        "deficiencies:read",
    )),
):
    """Return all notifications for the current user, newest first."""
    return NotificationRepository(db).get_for_user(user.id)


@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission(
        "users:read",
        "tests:read",
        "risks:read",
        "approvals:read",
        "exceptions:read",
        "deficiencies:read",
    )),
):
    ok = NotificationRepository(db).mark_read(notification_id, user.id)
    if not ok:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.post("/send-reminders")
def send_reminders(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("settings:write")),
):
    """
    Send overdue-milestone and expiring-exception reminder emails.
    Call this daily via a scheduled job.
    """
    today = date.today()
    expiry_threshold = today + timedelta(days=30)
    results = {"milestones_notified": 0, "exceptions_notified": 0, "errors": []}

    # ── Overdue milestones ────────────────────────────────────────────────────
    overdue_milestones = (
        db.query(TreatmentMilestone)
        .options(
            joinedload(TreatmentMilestone.assigned_to),
            joinedload(TreatmentMilestone.plan).joinedload(TreatmentPlan.risk),
        )
        .filter(
            TreatmentMilestone.due_date < today,
            TreatmentMilestone.status.notin_(["completed"]),
            TreatmentMilestone.assigned_to_id.isnot(None),
        )
        .all()
    )

    for m in overdue_milestones:
        try:
            if not (m.assigned_to and m.assigned_to.email):
                continue
            risk_name = m.plan.risk.name if (m.plan and m.plan.risk) else "Unknown Risk"
            subject, body = build_milestone_overdue_email(
                milestone_title=m.title,
                risk_name=risk_name,
                due_date=m.due_date.strftime("%d %b %Y"),
                assignee_name=m.assigned_to.display_name,
            )
            send_email(m.assigned_to.email, subject, body)
            results["milestones_notified"] += 1
        except Exception as exc:
            results["errors"].append(f"Milestone {m.id}: {exc}")

    # ── Expiring exceptions ───────────────────────────────────────────────────
    expiring_exceptions = (
        db.query(ControlException)
        .options(
            joinedload(ControlException.requester),
            joinedload(ControlException.control),
        )
        .filter(
            ControlException.expiry_date >= today,
            ControlException.expiry_date <= expiry_threshold,
            ControlException.status == "approved",
            ControlException.requested_by.isnot(None),
        )
        .all()
    )

    for exc in expiring_exceptions:
        try:
            if not (exc.requester and exc.requester.email):
                continue
            days_left = (exc.expiry_date - today).days
            control_name = exc.control.title if exc.control else "Unknown Control"
            subject, body = build_exception_expiring_email(
                exception_title=exc.title or exc.justification[:60],
                control_name=control_name,
                expiry_date=exc.expiry_date.strftime("%d %b %Y"),
                days_left=days_left,
                requester_name=exc.requester.display_name,
            )
            send_email(exc.requester.email, subject, body)
            results["exceptions_notified"] += 1
        except Exception as e:
            results["errors"].append(f"Exception {exc.id}: {e}")

    return results
