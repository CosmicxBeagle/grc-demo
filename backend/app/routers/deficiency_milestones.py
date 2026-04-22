from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, date

from app.db.database import get_db
from app.schemas.schemas import (
    DeficiencyMilestoneCreate, DeficiencyMilestoneUpdate, DeficiencyMilestoneOut,
    MilestoneExtensionRequest, MilestoneExtensionApprove,
)
from app.auth.permissions import require_permission
from app.models.models import User, Deficiency, DeficiencyMilestone

router = APIRouter(prefix="/deficiencies/{deficiency_id}/milestones", tags=["deficiency-milestones"])


def _get_deficiency(deficiency_id: int, db: Session) -> Deficiency:
    d = db.query(Deficiency).filter(Deficiency.id == deficiency_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Deficiency not found")
    return d


@router.get("", response_model=list[DeficiencyMilestoneOut])
def list_milestones(
    deficiency_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("deficiencies:read")),
):
    _get_deficiency(deficiency_id, db)
    return (
        db.query(DeficiencyMilestone)
        .options(joinedload(DeficiencyMilestone.assignee))
        .filter(DeficiencyMilestone.deficiency_id == deficiency_id)
        .order_by(DeficiencyMilestone.due_date.nullslast(), DeficiencyMilestone.id)
        .all()
    )


@router.post("", response_model=DeficiencyMilestoneOut, status_code=201)
def create_milestone(
    deficiency_id: int,
    data: DeficiencyMilestoneCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("deficiencies:write")),
):
    _get_deficiency(deficiency_id, db)
    m = DeficiencyMilestone(
        deficiency_id=deficiency_id,
        title=data.title,
        due_date=data.due_date,
        assignee_id=data.assignee_id,
        notes=data.notes,
        created_at=datetime.utcnow(),
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    # load assignee relationship
    return db.query(DeficiencyMilestone).options(joinedload(DeficiencyMilestone.assignee)).filter(DeficiencyMilestone.id == m.id).first()


@router.patch("/{milestone_id}", response_model=DeficiencyMilestoneOut)
def update_milestone(
    deficiency_id: int,
    milestone_id: int,
    data: DeficiencyMilestoneUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("deficiencies:write")),
):
    m = db.query(DeficiencyMilestone).filter(
        DeficiencyMilestone.id == milestone_id,
        DeficiencyMilestone.deficiency_id == deficiency_id,
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")

    if data.title is not None:
        m.title = data.title
    if data.due_date is not None:
        m.due_date = data.due_date
    if data.assignee_id is not None:
        m.assignee_id = data.assignee_id
    if data.notes is not None:
        m.notes = data.notes
    if data.status is not None:
        prev = m.status
        m.status = data.status
        if data.status == "completed" and prev != "completed":
            m.completed_at = datetime.utcnow()
        elif data.status != "completed":
            m.completed_at = None

    db.commit()
    return db.query(DeficiencyMilestone).options(joinedload(DeficiencyMilestone.assignee)).filter(DeficiencyMilestone.id == m.id).first()


@router.delete("/{milestone_id}", status_code=204)
def delete_milestone(
    deficiency_id: int,
    milestone_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("deficiencies:write")),
):
    m = db.query(DeficiencyMilestone).filter(
        DeficiencyMilestone.id == milestone_id,
        DeficiencyMilestone.deficiency_id == deficiency_id,
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    db.delete(m)
    db.commit()


# ── Loop 3: Extension request / approve / reject ──────────────────────────────

def _get_milestone(deficiency_id: int, milestone_id: int, db: Session) -> DeficiencyMilestone:
    m = (
        db.query(DeficiencyMilestone)
        .options(
            joinedload(DeficiencyMilestone.assignee),
            joinedload(DeficiencyMilestone.deficiency),
        )
        .filter(
            DeficiencyMilestone.id == milestone_id,
            DeficiencyMilestone.deficiency_id == deficiency_id,
        )
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return m


@router.post("/{milestone_id}/request-extension", response_model=DeficiencyMilestoneOut)
def request_extension(
    deficiency_id: int,
    milestone_id: int,
    data: MilestoneExtensionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("deficiencies:write")),
):
    """Request a due-date extension for a milestone. Notifies GRC managers."""
    m = _get_milestone(deficiency_id, milestone_id, db)
    from app.services.milestone_escalation_service import request_extension as svc_request
    svc_request(db, m, user, data.reason.strip())
    db.commit()
    return _get_milestone(deficiency_id, milestone_id, db)


@router.post("/{milestone_id}/approve-extension", response_model=DeficiencyMilestoneOut)
def approve_extension(
    deficiency_id: int,
    milestone_id: int,
    data: MilestoneExtensionApprove,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("deficiencies:write")),
):
    """Approve an extension request and set the new due date. Admin/GRC manager only."""
    m = _get_milestone(deficiency_id, milestone_id, db)
    from app.services.milestone_escalation_service import approve_extension as svc_approve
    svc_approve(db, m, user, data.new_due_date)
    db.commit()
    return _get_milestone(deficiency_id, milestone_id, db)


@router.post("/{milestone_id}/reject-extension", response_model=DeficiencyMilestoneOut)
def reject_extension(
    deficiency_id: int,
    milestone_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("deficiencies:write")),
):
    """Reject a pending extension request. Admin/GRC manager only."""
    m = _get_milestone(deficiency_id, milestone_id, db)
    from app.services.milestone_escalation_service import reject_extension as svc_reject
    svc_reject(db, m, user)
    db.commit()
    return _get_milestone(deficiency_id, milestone_id, db)


# ── Loop 3: Cron-triggered escalation ────────────────────────────────────────

escalation_router = APIRouter(prefix="/deficiency-milestones", tags=["deficiency-milestones"])


@escalation_router.post("/run-escalations")
def run_escalations(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("settings:write")),
):
    """
    Scan overdue milestones and escalate as needed.
    Call this daily via a scheduled job.
    """
    from app.services.milestone_escalation_service import run_milestone_escalations
    return run_milestone_escalations(db)
