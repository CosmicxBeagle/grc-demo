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
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.auth.local_auth import get_current_user
from app.auth.permissions import require_permission
from app.models.models import (
    User, RiskReviewRequest, RiskReviewUpdate,
)
from app.schemas.schemas import (
    RiskReviewCycleCreate, RiskReviewCycleOut, RiskReviewCycleDetail,
    RiskReviewRequestOut, RiskReviewUpdateCreate, RiskReviewUpdateOut,
)
import app.services.risk_review_service as svc

router = APIRouter(prefix="/risk-reviews", tags=["risk-reviews"])


# ── Cycles ────────────────────────────────────────────────────────────────────

@router.get("/cycles", response_model=list[RiskReviewCycleOut])
def list_cycles(db: Session = Depends(get_db), _=Depends(get_current_user)):
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


@router.post("/cycles", response_model=RiskReviewCycleOut,
             dependencies=[Depends(require_permission("risks:write"))])
def create_cycle(
    body: RiskReviewCycleCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cycle = svc.create_cycle(
        db         = db,
        label      = body.label,
        cycle_type = body.cycle_type,
        year       = body.year,
        scope_note = body.scope_note,
        created_by = user.id,
        min_score  = body.min_score,
    )
    out = RiskReviewCycleOut.model_validate(cycle)
    return out


@router.get("/cycles/{cycle_id}", response_model=RiskReviewCycleDetail)
def get_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    _:  User    = Depends(get_current_user),
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
    cycle = svc.close_cycle(db, cycle_id)
    return RiskReviewCycleOut.model_validate(cycle)


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
    user: User    = Depends(get_current_user),
):
    return svc.get_my_pending_requests(db, user.id)


@router.post("/requests/{request_id}/update", response_model=RiskReviewUpdateOut)
def submit_update(
    request_id: int,
    body: RiskReviewUpdateCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    return svc.submit_update(
        db                  = db,
        request_id          = request_id,
        submitted_by_id     = user.id,
        status_confirmed    = body.status_confirmed,
        mitigation_progress = body.mitigation_progress,
        notes               = body.notes,
    )


# ── History ───────────────────────────────────────────────────────────────────

@router.get("/history/{risk_id}", response_model=list[RiskReviewUpdateOut])
def risk_history(
    risk_id: int,
    db: Session = Depends(get_db),
    _:  User    = Depends(get_current_user),
):
    return svc.get_risk_history(db, risk_id)
