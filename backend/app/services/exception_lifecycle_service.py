"""
Exception lifecycle service — Workstream 4B.

Handles post-approval notifications, expiry tracking, and resubmission.
"""
from datetime import datetime, timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.models import ControlException, User
from app.repositories.repositories import NotificationRepository
from app.services.email_service import send_email


DEFAULT_EXPIRY_DAYS = 365


def on_exception_approved(
    db: Session,
    exception: ControlException,
    approver: User,
    requested_duration_days: int = DEFAULT_EXPIRY_DAYS,
) -> None:
    """
    Called after an exception is approved.
    Sets expiry, notifies requestor. Does NOT commit.
    """
    now = datetime.utcnow()
    exception.expires_at = now + timedelta(days=requested_duration_days)
    exception.decision_notified_at = now

    repo = NotificationRepository(db)
    if exception.requested_by:
        message = (
            f"Your exception request '{_exc_title(exception)}' has been approved. "
            f"It expires on {exception.expires_at.strftime('%d %b %Y')}."
        )
        repo.create(
            user_id=exception.requested_by,
            message=message,
            entity_type="control_exception",
            entity_id=exception.id,
        )
        if exception.requester and exception.requester.email:
            send_email(
                exception.requester.email,
                f"[GRC] Exception Approved: {_exc_title(exception)}",
                f"""<h2 style="color:#16a34a">Exception Approved</h2>
                <p>Your exception <strong>{_exc_title(exception)}</strong> has been approved.</p>
                <p>It will expire on <strong>{exception.expires_at.strftime('%d %b %Y')}</strong>.</p>""",
            )


def on_exception_rejected(
    db: Session,
    exception: ControlException,
    approver: User,
    rejection_reason: str,
) -> None:
    """
    Called after an exception is rejected.
    Stores reason, notifies requestor. Does NOT commit.
    """
    now = datetime.utcnow()
    exception.rejection_reason = rejection_reason
    exception.decision_notified_at = now

    repo = NotificationRepository(db)
    if exception.requested_by:
        message = (
            f"Your exception request '{_exc_title(exception)}' was rejected. "
            f"Reason: {rejection_reason}"
        )
        repo.create(
            user_id=exception.requested_by,
            message=message,
            entity_type="control_exception",
            entity_id=exception.id,
        )
        if exception.requester and exception.requester.email:
            send_email(
                exception.requester.email,
                f"[GRC] Exception Rejected: {_exc_title(exception)}",
                f"""<h2 style="color:#dc2626">Exception Rejected</h2>
                <p>Your exception <strong>{_exc_title(exception)}</strong> was rejected.</p>
                <p><strong>Reason:</strong> {rejection_reason}</p>
                <p>You may resubmit after addressing the concerns raised.</p>""",
            )


def resubmit_exception(
    db: Session,
    original: ControlException,
    requestor: User,
) -> ControlException:
    """
    Create a new exception record linked to the rejected original.
    Does NOT commit.
    """
    if original.status != "rejected":
        raise HTTPException(status_code=400, detail="Only rejected exceptions can be resubmitted")

    now = datetime.utcnow()
    new_exc = ControlException(
        control_id=original.control_id,
        title=original.title,
        exception_type=original.exception_type,
        justification=original.justification,
        compensating_control=original.compensating_control,
        risk_level=original.risk_level,
        status="draft",
        requested_by=requestor.id,
        expiry_date=original.expiry_date,
        parent_exception_id=original.id,
        resubmission_count=(original.resubmission_count or 0) + 1,
        created_at=now,
        updated_at=now,
    )
    db.add(new_exc)
    db.flush()
    return new_exc


def run_exception_lifecycle(db: Session) -> dict:
    """
    Cron job: sends 30-day expiry warnings and marks expired exceptions.
    Designed to run daily. Returns a summary.
    """
    now = datetime.utcnow()
    today = now.date()
    warn_threshold = today + timedelta(days=30)
    results = {"warned": 0, "expired": 0, "errors": []}

    repo = NotificationRepository(db)

    # 30-day warning
    soon_expiring = (
        db.query(ControlException)
        .options(joinedload(ControlException.requester))
        .filter(
            ControlException.status == "approved",
            ControlException.expires_at.isnot(None),
            ControlException.expiry_notified_at.is_(None),
            ControlException.expires_at >= now,
        )
        .all()
    )
    for exc in soon_expiring:
        try:
            if exc.expires_at and exc.expires_at.date() <= warn_threshold:
                days_left = (exc.expires_at.date() - today).days
                msg = f"Exception '{_exc_title(exc)}' expires in {days_left} day(s)."
                if exc.requested_by:
                    repo.create(user_id=exc.requested_by, message=msg, entity_type="control_exception", entity_id=exc.id)
                if exc.requester and exc.requester.email:
                    send_email(exc.requester.email, f"[GRC] Exception Expiring: {_exc_title(exc)}", f"<p>{msg}</p>")
                exc.expiry_notified_at = now
                results["warned"] += 1
        except Exception as e:
            results["errors"].append(f"warn {exc.id}: {e}")

    # Mark expired
    just_expired = (
        db.query(ControlException)
        .options(joinedload(ControlException.requester))
        .filter(
            ControlException.status == "approved",
            ControlException.expires_at.isnot(None),
            ControlException.expires_at < now,
            ControlException.expired_at.is_(None),
        )
        .all()
    )
    for exc in just_expired:
        try:
            exc.expired_at = now
            exc.status = "expired"
            msg = f"Exception '{_exc_title(exc)}' has expired."
            if exc.requested_by:
                repo.create(user_id=exc.requested_by, message=msg, entity_type="control_exception", entity_id=exc.id)
            if exc.requester and exc.requester.email:
                send_email(exc.requester.email, f"[GRC] Exception Expired: {_exc_title(exc)}", f"<p>{msg}</p>")
            results["expired"] += 1
        except Exception as e:
            results["errors"].append(f"expire {exc.id}: {e}")

    db.commit()
    return results


def _exc_title(exc: ControlException) -> str:
    return exc.title or (exc.justification[:60] if exc.justification else f"Exception #{exc.id}")
