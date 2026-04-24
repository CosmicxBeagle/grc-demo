from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.auth.permissions import require_permission
from app.models.models import User, TreatmentMilestone, TreatmentPlan
from app.schemas.schemas import (
    TreatmentPlanCreate, TreatmentPlanUpdate, TreatmentPlanOut,
    TreatmentMilestoneCreate, TreatmentMilestoneUpdate, TreatmentMilestoneOut,
    MilestoneExtensionRequest, MilestoneExtensionApprove,
)
from app.services.treatment_plan_service import TreatmentPlanService
from app.services import audit_service

router = APIRouter(prefix="/treatment-plans", tags=["treatment-plans"])


# ── Internal helper ────────────────────────────────────────────────────────────

def _get_milestone_with_relations(milestone_id: int, db: Session) -> TreatmentMilestone:
    from fastapi import HTTPException
    m = (
        db.query(TreatmentMilestone)
        .options(
            joinedload(TreatmentMilestone.assigned_to),
            joinedload(TreatmentMilestone.plan).joinedload(TreatmentPlan.risk),
        )
        .filter(TreatmentMilestone.id == milestone_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Treatment milestone not found")
    return m


def _plan_parent_name(milestone: TreatmentMilestone) -> str:
    if milestone.plan and milestone.plan.risk:
        return f"Treatment Plan (Risk: {milestone.plan.risk.title})"
    return f"Treatment Plan #{milestone.plan_id}"


# ── Plans ──────────────────────────────────────────────────────────────────────

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
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    plan = TreatmentPlanService.create(db, data)
    audit_service.emit(
        db, "TREATMENT_PLAN_CREATED", actor=current_user,
        resource_type="TreatmentPlan", resource_id=plan.id,
        resource_name=f"Treatment Plan for Risk #{plan.risk_id}",
        after={"strategy": plan.strategy, "status": plan.status},
        request=request,
    )
    return plan


@router.put("/{plan_id}", response_model=TreatmentPlanOut)
def update_plan(
    plan_id: int,
    data: TreatmentPlanUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    before_status = None
    existing = db.query(TreatmentPlan).filter(TreatmentPlan.id == plan_id).first()
    if existing:
        before_status = existing.status

    plan = TreatmentPlanService.update(db, plan_id, data)
    audit_service.emit(
        db, "TREATMENT_PLAN_UPDATED", actor=current_user,
        resource_type="TreatmentPlan", resource_id=plan.id,
        resource_name=f"Treatment Plan #{plan.id}",
        before={"status": before_status},
        after={"strategy": plan.strategy, "status": plan.status},
        request=request,
    )
    return plan


@router.delete("/{plan_id}", status_code=204)
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:write")),
):
    TreatmentPlanService.delete(db, plan_id)


# ── Milestones ─────────────────────────────────────────────────────────────────

@router.post("/{plan_id}/milestones", response_model=TreatmentMilestoneOut, status_code=201)
def add_milestone(
    plan_id: int,
    data: TreatmentMilestoneCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    milestone = TreatmentPlanService.add_milestone(db, plan_id, data)
    audit_service.emit(
        db, "TREATMENT_MILESTONE_CREATED", actor=current_user,
        resource_type="TreatmentMilestone", resource_id=milestone.id,
        resource_name=milestone.title,
        after={"plan_id": plan_id, "due_date": str(milestone.due_date)},
        request=request,
    )
    return milestone


@router.put("/milestones/{milestone_id}", response_model=TreatmentMilestoneOut)
def update_milestone(
    milestone_id: int,
    data: TreatmentMilestoneUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    existing = db.query(TreatmentMilestone).filter(TreatmentMilestone.id == milestone_id).first()
    before_status = existing.status if existing else None

    milestone = TreatmentPlanService.update_milestone(db, milestone_id, data)

    event = "TREATMENT_MILESTONE_COMPLETED" if milestone.status == "completed" else "TREATMENT_MILESTONE_UPDATED"
    audit_service.emit(
        db, event, actor=current_user,
        resource_type="TreatmentMilestone", resource_id=milestone.id,
        resource_name=milestone.title,
        before={"status": before_status},
        after={"status": milestone.status},
        request=request,
    )
    return milestone


@router.delete("/milestones/{milestone_id}", status_code=204)
def delete_milestone(
    milestone_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:write")),
):
    TreatmentPlanService.delete_milestone(db, milestone_id)


# ── Milestone extension workflow ───────────────────────────────────────────────

@router.post("/milestones/{milestone_id}/request-extension",
             response_model=TreatmentMilestoneOut)
def request_extension(
    milestone_id: int,
    data: MilestoneExtensionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    """Request a due-date extension for a treatment milestone. Notifies GRC managers."""
    from app.services.milestone_escalation_service import request_extension as svc_req
    m = _get_milestone_with_relations(milestone_id, db)
    svc_req(db, m, current_user, data.reason.strip(), _plan_parent_name(m))
    db.commit()
    audit_service.emit(
        db, "TREATMENT_MILESTONE_EXTENSION_REQUESTED", actor=current_user,
        resource_type="TreatmentMilestone", resource_id=m.id,
        resource_name=m.title,
        after={"reason": data.reason.strip()},
        request=request,
    )
    return _get_milestone_with_relations(milestone_id, db)


@router.post("/milestones/{milestone_id}/approve-extension",
             response_model=TreatmentMilestoneOut)
def approve_extension(
    milestone_id: int,
    data: MilestoneExtensionApprove,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    """Approve an extension request and set the new due date. Admin/GRC manager only."""
    from app.services.milestone_escalation_service import approve_extension as svc_appr
    m = _get_milestone_with_relations(milestone_id, db)
    svc_appr(db, m, current_user, data.new_due_date, _plan_parent_name(m))
    db.commit()
    audit_service.emit(
        db, "TREATMENT_MILESTONE_EXTENSION_APPROVED", actor=current_user,
        resource_type="TreatmentMilestone", resource_id=m.id,
        resource_name=m.title,
        after={"new_due_date": str(data.new_due_date)},
        request=request,
    )
    return _get_milestone_with_relations(milestone_id, db)


@router.post("/milestones/{milestone_id}/reject-extension",
             response_model=TreatmentMilestoneOut)
def reject_extension(
    milestone_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    """Reject a pending extension request. Admin/GRC manager only."""
    from app.services.milestone_escalation_service import reject_extension as svc_rej
    m = _get_milestone_with_relations(milestone_id, db)
    svc_rej(db, m, current_user, _plan_parent_name(m))
    db.commit()
    audit_service.emit(
        db, "TREATMENT_MILESTONE_EXTENSION_REJECTED", actor=current_user,
        resource_type="TreatmentMilestone", resource_id=m.id,
        resource_name=m.title,
        request=request,
    )
    return _get_milestone_with_relations(milestone_id, db)


# ── Cron endpoint ──────────────────────────────────────────────────────────────

treatment_escalation_router = APIRouter(
    prefix="/treatment-milestones", tags=["treatment-plans"]
)


@treatment_escalation_router.post("/run-escalations")
def run_treatment_escalations(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("settings:write")),
):
    """
    Scan overdue treatment-plan milestones and escalate as needed.
    Call this daily via a scheduled job (mirrors /deficiency-milestones/run-escalations).
    """
    from app.services.milestone_escalation_service import run_treatment_milestone_escalations
    return run_treatment_milestone_escalations(db)
