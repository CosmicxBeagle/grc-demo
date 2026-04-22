from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.permissions import require_permission
from app.db.database import get_db
from app.models.models import User
from app.schemas.schemas import (
    ApprovalPolicyCreate, ApprovalPolicyUpdate, ApprovalPolicyOut,
    ApprovalWorkflowCreate, ApprovalWorkflowOut,
    ApprovalDecisionRequest,
)
from app.services.approval_service import ApprovalPolicyService, ApprovalWorkflowService

router = APIRouter(prefix="/approvals", tags=["approvals"])


# ── Policies ─────────────────────────────────────────────────────────────────

@router.get("/policies", response_model=list[ApprovalPolicyOut])
def list_policies(
    entity_type: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("approvals:read")),
):
    return ApprovalPolicyService(db).list_policies(entity_type)


@router.post("/policies", response_model=ApprovalPolicyOut)
def create_policy(
    data: ApprovalPolicyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("approvals:manage_policies")),
):
    return ApprovalPolicyService(db).create_policy(data)


@router.get("/policies/{policy_id}", response_model=ApprovalPolicyOut)
def get_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("approvals:read")),
):
    return ApprovalPolicyService(db).get_policy(policy_id)


@router.put("/policies/{policy_id}", response_model=ApprovalPolicyOut)
def update_policy(
    policy_id: int,
    data: ApprovalPolicyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("approvals:manage_policies")),
):
    return ApprovalPolicyService(db).update_policy(policy_id, data)


@router.delete("/policies/{policy_id}", status_code=204)
def delete_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("approvals:manage_policies")),
):
    ApprovalPolicyService(db).delete_policy(policy_id)


# ── Workflows ────────────────────────────────────────────────────────────────

@router.post("/workflows", response_model=ApprovalWorkflowOut)
def create_workflow(
    data: ApprovalWorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("approvals:read")),
):
    """Start an approval workflow for any entity."""
    svc = ApprovalWorkflowService(db)
    # Fetch entity data for escalation rule evaluation
    entity_data = _get_entity_data(db, data.entity_type, data.entity_id)
    return svc.create_workflow(
        policy_id=data.policy_id,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        entity_data=entity_data,
        created_by_id=current_user.id,
    )


@router.get("/workflows/queue", response_model=list[ApprovalWorkflowOut])
def my_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("approvals:read")),
):
    """Returns workflows where the current user is the pending approver."""
    return ApprovalWorkflowService(db).get_my_queue(current_user)


@router.get("/workflows/entity/{entity_type}/{entity_id}", response_model=Optional[ApprovalWorkflowOut])
def get_entity_workflow(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("approvals:read")),
):
    """Return the current workflow for a given record."""
    return ApprovalWorkflowService(db).get_for_entity(entity_type, entity_id)


@router.post("/workflows/{workflow_id}/decide", response_model=ApprovalWorkflowOut)
def decide(
    workflow_id: int,
    req: ApprovalDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("approvals:decide")),
):
    """Approve or reject the current step of a workflow."""
    return ApprovalWorkflowService(db).decide(workflow_id, req, current_user)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_entity_data(db: Session, entity_type: str, entity_id: int) -> dict:
    """Pull relevant fields from an entity for escalation rule evaluation."""
    from app.models.models import ControlException, TestAssignment
    if entity_type == "exception":
        obj = db.query(ControlException).filter(ControlException.id == entity_id).first()
        return {"risk_level": obj.risk_level, "exception_type": obj.exception_type} if obj else {}
    if entity_type == "control_test":
        obj = db.query(TestAssignment).filter(TestAssignment.id == entity_id).first()
        return {"status": obj.status} if obj else {}
    return {}
