"""
Risk Review router.

Endpoints:
  GET  /risk-reviews/cycles                  – list all cycles
  POST /risk-reviews/cycles                  – create a draft cycle
  GET  /risk-reviews/cycles/{id}             – cycle detail with requests
  PATCH /risk-reviews/cycles/{id}/close      – close a cycle
  POST /risk-reviews/cycles/{id}/launch      – auto-add risks + send emails
  POST /risk-reviews/cycles/{id}/remind      – send 7-day reminders
  GET  /risk-reviews/requests/my             – pending requests for current user
  POST /risk-reviews/requests/{id}/update    – director submits update
  GET  /risk-reviews/history/{risk_id}       – full audit log for a risk

  4C: GRC approval step
  POST /risk-reviews/updates/{id}/accept     – GRC accepts an update
  POST /risk-reviews/updates/{id}/challenge  – GRC challenges an update
  POST /risk-reviews/updates/{id}/respond    – risk owner responds to challenge
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.auth.permissions import require_permission
from app.models.models import (
    User, RiskReviewRequest, RiskReviewUpdate,
)
from app.schemas.schemas import (
    RiskReviewCycleCreate, RiskReviewCycleOut, RiskReviewCycleDetail,
    RiskReviewRequestOut, RiskReviewUpdateCreate, RiskReviewUpdateOut,
)
import app.services.risk_review_service as svc
from app.services import risk_review_grc_service

router = APIRouter(prefix="/risk-reviews", tags=["risk-reviews"])


# ── Request bodies for 4C endpoints ──────────────────────────────────────────

class GRCChallengeRequest(BaseModel):
    reason: str = Field(..., min_length=10)

class OwnerResponseRequest(BaseModel):
    response: str = Field(..., min_length=10)


# ── Cycles ────────────────────────────────────────────────────────────────────

@router.get("/cycles", response_model=list[RiskReviewCycleOut])
def list_cycles(db: Session = Depends(get_db), _=Depends(require_permission("risks:read"))):
    cycles = svc.list_cycles(db)
    result = []
    for c in cycles:
        reqs   = c.requests
        out    = RiskReviewCycleOut.model_validate(c)
        out.request_count = len(reqs)
        out.pending_count = sum(1 for r in reqs if r.status == "pending")
        out.updated_count = sum(1 for r in reqs if r.status == "updated")
        result.append(out)
    return result


@router.post("/cycles", response_model=RiskReviewCycleOut)
def create_cycle(
    body: RiskReviewCycleCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_permission("risks:write")),
):
    cycle = svc.create_cycle(
        db         = db,
        label      = body.label,
        cycle_type = body.cycle_type,
        year       = body.year,
        scope_note = body.scope_note,
        created_by = user.id,
        min_score  = body.min_score,
        severities = body.severities,
    )
    out = RiskReviewCycleOut.model_validate(cycle)
    return out


@router.get("/cycles/{cycle_id}", response_model=RiskReviewCycleDetail)
def get_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    _:  User    = Depends(require_permission("risks:read")),
):
    cycle = svc.get_cycle(db, cycle_id)
    reqs  = cycle.requests
    out   = RiskReviewCycleDetail.model_validate(cycle)
    out.request_count = len(reqs)
    out.pending_count = sum(1 for r in reqs if r.status == "pending")
    out.updated_count = sum(1 for r in reqs if r.status == "updated")
    return out


@router.patch("/cycles/{cycle_id}/close", response_model=RiskReviewCycleOut,
              dependencies=[Depends(require_permission("risks:write"))])
def close_cycle(cycle_id: int, db: Session = Depends(get_db)):
    # Check no pending updates
    pending = (
        db.query(RiskReviewUpdate)
        .join(RiskReviewRequest, RiskReviewUpdate.request_id == RiskReviewRequest.id)
        .filter(
            RiskReviewRequest.cycle_id == cycle_id,
            RiskReviewUpdate.grc_review_status.in_(["pending_review", "challenged"]),
        )
        .count()
    )
    if pending > 0:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot close cycle: {pending} risk review update(s) are still pending GRC approval."
        )
    cycle = svc.close_cycle(db, cycle_id)
    return RiskReviewCycleOut.model_validate(cycle)


@router.post("/cycles/{cycle_id}/populate",
             dependencies=[Depends(require_permission("risks:write"))])
def populate_cycle(cycle_id: int, db: Session = Depends(get_db)):
    """Auto-import in-scope risks without sending any emails."""
    return svc.populate_cycle(db, cycle_id)


@router.post("/cycles/{cycle_id}/notify-owner/{owner_id}",
             dependencies=[Depends(require_permission("risks:write"))])
def notify_owner(cycle_id: int, owner_id: int, db: Session = Depends(get_db)):
    """Send (or re-send) the review email to a single owner."""
    return svc.notify_owner(db, cycle_id, owner_id)


@router.post("/cycles/{cycle_id}/launch",
             dependencies=[Depends(require_permission("risks:write"))])
def launch_cycle(cycle_id: int, db: Session = Depends(get_db)):
    return svc.launch_cycle(db, cycle_id)


@router.post("/cycles/{cycle_id}/remind",
             dependencies=[Depends(require_permission("risks:write"))])
def send_reminders(
    cycle_id:       int,
    threshold_days: int = 7,
    db: Session = Depends(get_db),
):
    return svc.send_reminders(db, cycle_id, threshold_days)


# ── Requests ──────────────────────────────────────────────────────────────────

@router.get("/requests/my", response_model=list[RiskReviewRequestOut])
def my_pending(
    db:   Session = Depends(get_db),
    user: User    = Depends(require_permission("risks:review_update")),
):
    return svc.get_my_pending_requests(db, user.id)


@router.post("/requests/{request_id}/update", response_model=RiskReviewUpdateOut)
def submit_update(
    request_id: int,
    body: RiskReviewUpdateCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_permission("risks:review_update")),
):
    return svc.submit_update(
        db                  = db,
        request_id          = request_id,
        submitted_by_id     = user.id,
        status_confirmed    = body.status_confirmed,
        mitigation_progress = body.mitigation_progress,
        notes               = body.notes,
    )


# ── 4C: GRC approval step ─────────────────────────────────────────────────────

@router.post("/updates/{update_id}/accept")
def grc_accept_update(
    update_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risks:review_update")),
):
    """GRC accepts a submitted risk review update."""
    upd = risk_review_grc_service.accept_update(db, update_id, user)
    db.commit()
    return {"id": upd.id, "grc_review_status": upd.grc_review_status}


@router.post("/updates/{update_id}/challenge")
def grc_challenge_update(
    update_id: int,
    data: GRCChallengeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risks:review_update")),
):
    """GRC challenges a submitted risk review update."""
    upd = risk_review_grc_service.challenge_update(db, update_id, user, data.reason)
    db.commit()
    return {"id": upd.id, "grc_review_status": upd.grc_review_status}


@router.post("/updates/{update_id}/respond")
def owner_respond_to_challenge(
    update_id: int,
    data: OwnerResponseRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risks:review_update")),
):
    """Risk owner responds to a GRC challenge."""
    upd = risk_review_grc_service.respond_to_challenge(db, update_id, user, data.response)
    db.commit()
    return {"id": upd.id, "owner_responded_at": upd.owner_responded_at.isoformat() if upd.owner_responded_at else None}


# ── History ───────────────────────────────────────────────────────────────────

@router.get("/history/{risk_id}", response_model=list[RiskReviewUpdateOut])
def risk_history(
    risk_id: int,
    db: Session = Depends(get_db),
    _:  User    = Depends(require_permission("risks:read")),
):
    return svc.get_risk_history(db, risk_id)
