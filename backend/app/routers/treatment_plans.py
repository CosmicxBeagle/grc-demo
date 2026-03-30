from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.auth.permissions import require_permission
from app.models.models import User
from app.schemas.schemas import (
    TreatmentPlanCreate, TreatmentPlanUpdate, TreatmentPlanOut,
    TreatmentMilestoneCreate, TreatmentMilestoneUpdate, TreatmentMilestoneOut,
)
from app.services.treatment_plan_service import TreatmentPlanService

router = APIRouter(prefix="/treatment-plans", tags=["treatment-plans"])


# ── Plans ──────────────────────────────────────────────────────────────────

@router.get("/risk/{risk_id}", response_model=TreatmentPlanOut | None)
def get_plan_for_risk(
    risk_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:read")),
):
    return TreatmentPlanService.get_by_risk(db, risk_id)


@router.post("", response_model=TreatmentPlanOut, status_code=201)
def create_plan(
    data: TreatmentPlanCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:write")),
):
    return TreatmentPlanService.create(db, data)


@router.put("/{plan_id}", response_model=TreatmentPlanOut)
def update_plan(
    plan_id: int,
    data: TreatmentPlanUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:write")),
):
    return TreatmentPlanService.update(db, plan_id, data)


@router.delete("/{plan_id}", status_code=204)
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:write")),
):
    TreatmentPlanService.delete(db, plan_id)


# ── Milestones ──────────────────────────────────────────────────────────────

@router.post("/{plan_id}/milestones", response_model=TreatmentMilestoneOut, status_code=201)
def add_milestone(
    plan_id: int,
    data: TreatmentMilestoneCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:write")),
):
    return TreatmentPlanService.add_milestone(db, plan_id, data)


@router.put("/milestones/{milestone_id}", response_model=TreatmentMilestoneOut)
def update_milestone(
    milestone_id: int,
    data: TreatmentMilestoneUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:write")),
):
    return TreatmentPlanService.update_milestone(db, milestone_id, data)


@router.delete("/milestones/{milestone_id}", status_code=204)
def delete_milestone(
    milestone_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:write")),
):
    TreatmentPlanService.delete_milestone(db, milestone_id)
