"""
Risk review GRC approval step — Workstream 4C.
"""
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.models import RiskReviewUpdate, RiskReviewRequest, User
from app.repositories.repositories import NotificationRepository
from app.services.email_service import (
    send_email,
    build_challenge_email,
    build_owner_response_email,
)


def accept_update(db: Session, update_id: int, reviewer: User) -> RiskReviewUpdate:
    """Mark a submitted risk review update as accepted. Does NOT commit."""
    upd = _get_update(db, update_id)
    if upd.grc_review_status not in ("pending_review",):
        raise HTTPException(status_code=400, detail="Update is not pending review")

    upd.grc_review_status    = "accepted"
    upd.grc_reviewer_user_id = reviewer.id
    upd.grc_reviewed_at      = datetime.utcnow()
    return upd


def challenge_update(
    db: Session,
    update_id: int,
    reviewer: User,
    reason: str,
) -> RiskReviewUpdate:
    """Challenge a submitted risk review update. Notifies risk owner. Does NOT commit."""
    upd = _get_update(db, update_id)
    if upd.grc_review_status not in ("pending_review",):
        raise HTTPException(status_code=400, detail="Update is not pending review")

    upd.grc_review_status       = "challenged"
    upd.grc_reviewer_user_id    = reviewer.id
    upd.grc_challenge_reason    = reason
    upd.grc_reviewed_at         = datetime.utcnow()
    # Clear any prior owner response so the thread stays clean
    upd.owner_challenge_response = None
    upd.owner_responded_at       = None

    repo = NotificationRepository(db)
    if upd.request and upd.request.owner:
        owner = upd.request.owner
        repo.create(
            user_id=owner.id,
            message=f"GRC has challenged your risk review update. Reason: {reason}",
            entity_type="risk_review_update",
            entity_id=upd.id,
        )
        if owner.email:
            risk = upd.request.risk if hasattr(upd.request, "risk") else None
            risk_name    = risk.name if risk else f"Risk #{upd.request.risk_id}"
            cycle        = upd.request.cycle if hasattr(upd.request, "cycle") else None
            cycle_label  = cycle.label if cycle else f"Cycle #{upd.cycle_id}"
            owner_name   = owner.display_name or owner.username
            subject, body = build_challenge_email(
                owner_name=owner_name,
                cycle_label=cycle_label,
                risk_name=risk_name,
                challenge_reason=reason,
                cycle_id=upd.cycle_id,
            )
            send_email(owner.email, subject, body)

    return upd


def respond_to_challenge(
    db: Session,
    update_id: int,
    requestor: User,
    response_text: str,
) -> RiskReviewUpdate:
    """Risk owner responds to a GRC challenge. Does NOT commit."""
    upd = _get_update(db, update_id)
    if upd.grc_review_status != "challenged":
        raise HTTPException(status_code=400, detail="Update is not in challenged status")

    upd.owner_challenge_response = response_text
    upd.owner_responded_at       = datetime.utcnow()
    upd.grc_review_status        = "pending_review"  # back to GRC queue

    repo = NotificationRepository(db)
    if upd.grc_reviewer_user_id:
        repo.create(
            user_id=upd.grc_reviewer_user_id,
            message=f"Risk owner has responded to your challenge on update #{update_id}.",
            entity_type="risk_review_update",
            entity_id=upd.id,
        )
        # Email the GRC reviewer
        from app.models.models import User as UserModel
        reviewer = db.query(UserModel).filter(UserModel.id == upd.grc_reviewer_user_id).first()
        if reviewer and reviewer.email:
            risk       = upd.request.risk if hasattr(upd.request, "risk") else None
            risk_name  = risk.name if risk else f"Risk #{upd.request.risk_id}"
            cycle      = upd.request.cycle if hasattr(upd.request, "cycle") else None
            cycle_label = cycle.label if cycle else f"Cycle #{upd.cycle_id}"
            owner_name  = requestor.display_name or requestor.username
            reviewer_name = reviewer.display_name or reviewer.username
            subject, body = build_owner_response_email(
                reviewer_name=reviewer_name,
                owner_name=owner_name,
                risk_name=risk_name,
                cycle_label=cycle_label,
                response_text=response_text,
                cycle_id=upd.cycle_id,
            )
            send_email(reviewer.email, subject, body)

    return upd


def _get_update(db: Session, update_id: int) -> RiskReviewUpdate:
    upd = (
        db.query(RiskReviewUpdate)
        .options(
            joinedload(RiskReviewUpdate.request).joinedload(RiskReviewRequest.owner),
        )
        .filter(RiskReviewUpdate.id == update_id)
        .first()
    )
    if not upd:
        raise HTTPException(status_code=404, detail="Risk review update not found")
    return upd
