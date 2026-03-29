"""
Risk Review Service

Orchestrates risk review cycles.  Which risks are included is driven by
min_score on the cycle record — not by a hardcoded cadence label:

  min_score = 0   → all risks with an assigned owner
  min_score = 4   → medium and above  (score >= 4)
  min_score = 12  → high and critical (score >= 12)
  min_score = 20  → critical only     (score >= 20)

Score = likelihood × impact (each 1-5):
  critical  >= 20
  high      >= 12
  medium    >=  4
  low        <  4
"""
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.models import (
    Risk, RiskReviewCycle, RiskReviewRequest, RiskReviewUpdate, User,
)
from app.services.email_service import (
    build_risk_review_email, build_reminder_email, send_email,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _score_tier(likelihood: int, impact: int) -> str:
    score = (likelihood or 1) * (impact or 1)
    if score >= 20: return "critical"
    if score >= 12: return "high"
    if score >= 4:  return "medium"
    return "low"


def _risk_to_dict(risk: Risk) -> dict:
    score = (risk.likelihood or 1) * (risk.impact or 1)
    return {
        "id":           risk.id,
        "name":         risk.name,
        "score":        score,
        "tier":         _score_tier(risk.likelihood, risk.impact),
        "status":       risk.status or "open",
        "treatment":    risk.treatment or "mitigate",
        "last_updated": risk.updated_at.strftime("%Y-%m-%d") if risk.updated_at else "—",
    }


def _in_scope_for_cycle(risk: Risk, min_score: int) -> bool:
    """Return True if this risk meets the cycle's minimum score threshold."""
    score = (risk.likelihood or 1) * (risk.impact or 1)
    return score >= min_score


# ── Cycle CRUD ────────────────────────────────────────────────────────────────

def create_cycle(
    db: Session,
    label: str,
    cycle_type: str,
    year: Optional[int],
    scope_note: Optional[str],
    created_by: int,
    min_score: int = 0,
) -> RiskReviewCycle:
    cycle = RiskReviewCycle(
        label      = label,
        cycle_type = cycle_type,
        year       = year,
        scope_note = scope_note,
        created_by = created_by,
        min_score  = min_score,
        status     = "draft",
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle


def get_cycle(db: Session, cycle_id: int) -> RiskReviewCycle:
    cycle = db.query(RiskReviewCycle).filter(RiskReviewCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(404, "Review cycle not found")
    return cycle


def list_cycles(db: Session) -> list[RiskReviewCycle]:
    return db.query(RiskReviewCycle).order_by(RiskReviewCycle.created_at.desc()).all()


def close_cycle(db: Session, cycle_id: int) -> RiskReviewCycle:
    cycle = get_cycle(db, cycle_id)
    cycle.status    = "closed"
    cycle.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(cycle)
    return cycle


# ── Launch ────────────────────────────────────────────────────────────────────

def launch_cycle(db: Session, cycle_id: int) -> dict:
    """
    Auto-include in-scope risks, create RiskReviewRequests, send emails.
    Returns summary: { emails_sent, requests_created, skipped_no_owner }.
    """
    cycle = get_cycle(db, cycle_id)
    if cycle.status != "draft":
        raise HTTPException(400, "Only draft cycles can be launched")

    risks = db.query(Risk).filter(
        Risk.owner_id.isnot(None),
        Risk.status.notin_(["closed"]),
    ).all()

    in_scope = [r for r in risks if _in_scope_for_cycle(r, cycle.min_score)]
    skipped  = len([r for r in db.query(Risk).all() if r.owner_id is None])

    # Group by owner
    owner_risks: dict[int, list[Risk]] = defaultdict(list)
    for risk in in_scope:
        owner_risks[risk.owner_id].append(risk)

    emails_sent = 0
    requests_created = 0
    now = datetime.utcnow()

    for owner_id, owner_risk_list in owner_risks.items():
        owner = db.query(User).filter(User.id == owner_id).first()
        if not owner:
            continue

        # Create requests
        for risk in owner_risk_list:
            # Skip if request already exists for this cycle+risk
            existing = db.query(RiskReviewRequest).filter(
                RiskReviewRequest.cycle_id == cycle_id,
                RiskReviewRequest.risk_id  == risk.id,
            ).first()
            if existing:
                continue
            req = RiskReviewRequest(
                cycle_id      = cycle_id,
                risk_id       = risk.id,
                owner_id      = owner_id,
                status        = "pending",
                email_sent_at = now,
            )
            db.add(req)
            requests_created += 1

        # Build and send one email per owner covering all their risks
        risk_dicts = [_risk_to_dict(r) for r in owner_risk_list]
        subject, body = build_risk_review_email(
            owner_name  = owner.display_name,
            cycle_label = cycle.label,
            risks       = risk_dicts,
            cycle_id    = cycle_id,
        )
        if send_email(owner.email, subject, body):
            emails_sent += 1

    cycle.status      = "active"
    cycle.launched_at = now
    db.commit()

    return {
        "emails_sent":       emails_sent,
        "requests_created":  requests_created,
        "skipped_no_owner":  skipped,
    }


# ── Reminders ─────────────────────────────────────────────────────────────────

def send_reminders(db: Session, cycle_id: int, threshold_days: int = 7) -> dict:
    """
    Send reminder emails for all pending requests in the cycle that haven't
    been reminded in `threshold_days` days.
    """
    cycle = get_cycle(db, cycle_id)
    if cycle.status != "active":
        raise HTTPException(400, "Can only send reminders for active cycles")

    cutoff = datetime.utcnow() - timedelta(days=threshold_days)

    pending = db.query(RiskReviewRequest).filter(
        RiskReviewRequest.cycle_id == cycle_id,
        RiskReviewRequest.status   == "pending",
    ).all()

    # Filter: last_reminded_at (or email_sent_at if never reminded) before cutoff
    due = [
        r for r in pending
        if (r.last_reminded_at or r.email_sent_at or datetime.utcnow()) <= cutoff
    ]

    # Group by owner
    owner_requests: dict[int, list[RiskReviewRequest]] = defaultdict(list)
    for req in due:
        owner_requests[req.owner_id].append(req)

    sent = 0
    now  = datetime.utcnow()

    for owner_id, reqs in owner_requests.items():
        owner = db.query(User).filter(User.id == owner_id).first()
        if not owner:
            continue

        # Compute days since first email
        first_sent = min(
            (r.email_sent_at or now for r in reqs),
            default=now,
        )
        days_out = (now - first_sent).days

        risk_dicts = [_risk_to_dict(r.risk) for r in reqs]
        subject, body = build_reminder_email(
            owner_name        = owner.display_name,
            cycle_label       = cycle.label,
            pending_risks     = risk_dicts,
            cycle_id          = cycle_id,
            days_outstanding  = days_out,
        )
        if send_email(owner.email, subject, body):
            sent += 1
            for req in reqs:
                req.last_reminded_at = now
                req.reminder_count   += 1

    db.commit()
    return {"reminders_sent": sent, "pending_owners": len(owner_requests)}


# ── Updates ───────────────────────────────────────────────────────────────────

def submit_update(
    db: Session,
    request_id: int,
    submitted_by_id: int,
    status_confirmed: Optional[str],
    mitigation_progress: Optional[str],
    notes: Optional[str],
) -> RiskReviewUpdate:
    req = db.query(RiskReviewRequest).filter(RiskReviewRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Review request not found")

    update = RiskReviewUpdate(
        request_id          = request_id,
        risk_id             = req.risk_id,
        cycle_id            = req.cycle_id,
        submitted_by        = submitted_by_id,
        status_confirmed    = status_confirmed,
        mitigation_progress = mitigation_progress,
        notes               = notes,
    )
    db.add(update)

    req.status = "updated"
    db.commit()
    db.refresh(update)
    return update


# ── History ───────────────────────────────────────────────────────────────────

def get_risk_history(db: Session, risk_id: int) -> list[RiskReviewUpdate]:
    """All review updates for a risk, newest first."""
    return (
        db.query(RiskReviewUpdate)
        .filter(RiskReviewUpdate.risk_id == risk_id)
        .order_by(RiskReviewUpdate.submitted_at.desc())
        .all()
    )


def get_my_pending_requests(db: Session, user_id: int) -> list[RiskReviewRequest]:
    """Pending review requests assigned to a specific user."""
    return (
        db.query(RiskReviewRequest)
        .filter(
            RiskReviewRequest.owner_id == user_id,
            RiskReviewRequest.status   == "pending",
        )
        .order_by(RiskReviewRequest.created_at.desc())
        .all()
    )
