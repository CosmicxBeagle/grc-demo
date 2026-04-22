"""
Approval Workflow Service

Handles:
  - Creating / updating approval policies (templates)
  - Spinning up a workflow instance from a policy
  - Processing approve / reject decisions (with back-one-step on rejection)
  - Applying escalation rules (e.g. add CISO step for critical exceptions)
  - Syncing entity status when a workflow completes or is rejected
"""
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.models import (
    ApprovalPolicy, ApprovalPolicyStep, ApprovalEscalationRule,
    ApprovalWorkflow, ApprovalWorkflowStep,
    ControlException, TestAssignment, User,
)
from app.schemas.schemas import (
    ApprovalPolicyCreate, ApprovalPolicyUpdate,
    ApprovalWorkflowCreate, ApprovalDecisionRequest,
)
from app.services.email_service import send_email, build_approval_request_email


# ── Entity display name helper ───────────────────────────────────────────────

def _get_entity_display_name(db: Session, entity_type: str, entity_id: int) -> str:
    """Return a human-readable name for the entity being approved."""
    from app.models.models import ControlException, TestAssignment
    if entity_type == "exception":
        obj = db.query(ControlException).filter(ControlException.id == entity_id).first()
        if obj:
            return obj.title or obj.justification[:60]
    if entity_type == "control_test":
        obj = db.query(TestAssignment).filter(TestAssignment.id == entity_id).first()
        if obj:
            return f"Control Test #{entity_id}"
    return f"{entity_type} #{entity_id}"


# ── Entity status sync ───────────────────────────────────────────────────────

_ENTITY_STATUS_MAP = {
    # entity_type → { workflow_outcome → entity status value }
    "exception":    {"approved": "approved", "rejected": "rejected"},
    "control_test": {"approved": "complete",  "rejected": "needs_review"},
}


def _sync_entity_status(db: Session, entity_type: str, entity_id: int, outcome: str):
    """Update the underlying record's status when a workflow finishes."""
    status_map = _ENTITY_STATUS_MAP.get(entity_type, {})
    new_status = status_map.get(outcome)
    if not new_status:
        return

    if entity_type == "exception":
        obj = db.query(ControlException).filter(ControlException.id == entity_id).first()
        if obj:
            obj.status = new_status
    elif entity_type == "control_test":
        obj = db.query(TestAssignment).filter(TestAssignment.id == entity_id).first()
        if obj:
            obj.status = new_status

    db.commit()


# ── Policy management ────────────────────────────────────────────────────────

class ApprovalPolicyService:

    def __init__(self, db: Session):
        self.db = db

    def list_policies(self, entity_type: Optional[str] = None) -> list[ApprovalPolicy]:
        q = self.db.query(ApprovalPolicy).options(
            joinedload(ApprovalPolicy.steps).joinedload(ApprovalPolicyStep.approver),
            joinedload(ApprovalPolicy.escalation_rules).joinedload(ApprovalEscalationRule.add_step_user),
        )
        if entity_type:
            q = q.filter(ApprovalPolicy.entity_type == entity_type)
        return q.order_by(ApprovalPolicy.name).all()

    def get_policy(self, policy_id: int) -> ApprovalPolicy:
        policy = self.db.query(ApprovalPolicy).options(
            joinedload(ApprovalPolicy.steps).joinedload(ApprovalPolicyStep.approver),
            joinedload(ApprovalPolicy.escalation_rules).joinedload(ApprovalEscalationRule.add_step_user),
        ).filter(ApprovalPolicy.id == policy_id).first()
        if not policy:
            raise HTTPException(404, "Approval policy not found")
        return policy

    def create_policy(self, data: ApprovalPolicyCreate) -> ApprovalPolicy:
        # If marked default, clear existing defaults for that entity type
        if data.is_default:
            self.db.query(ApprovalPolicy).filter(
                ApprovalPolicy.entity_type == data.entity_type,
                ApprovalPolicy.is_default == True,
            ).update({"is_default": False})

        policy = ApprovalPolicy(
            name=data.name,
            description=data.description,
            entity_type=data.entity_type,
            is_default=data.is_default,
        )
        self.db.add(policy)
        self.db.flush()

        for step_data in sorted(data.steps, key=lambda s: s.step_order):
            self.db.add(ApprovalPolicyStep(
                policy_id=policy.id,
                step_order=step_data.step_order,
                label=step_data.label,
                approver_user_id=step_data.approver_user_id,
                approver_role=step_data.approver_role,
            ))

        for rule_data in data.escalation_rules:
            self.db.add(ApprovalEscalationRule(
                policy_id=policy.id,
                condition_field=rule_data.condition_field,
                condition_value=rule_data.condition_value,
                add_step_label=rule_data.add_step_label,
                add_step_user_id=rule_data.add_step_user_id,
                add_step_role=rule_data.add_step_role,
            ))

        self.db.commit()
        self.db.refresh(policy)
        return self.get_policy(policy.id)

    def update_policy(self, policy_id: int, data: ApprovalPolicyUpdate) -> ApprovalPolicy:
        policy = self.get_policy(policy_id)

        if data.name is not None:
            policy.name = data.name
        if data.description is not None:
            policy.description = data.description
        if data.is_default is not None:
            if data.is_default:
                self.db.query(ApprovalPolicy).filter(
                    ApprovalPolicy.entity_type == policy.entity_type,
                    ApprovalPolicy.is_default == True,
                    ApprovalPolicy.id != policy_id,
                ).update({"is_default": False})
            policy.is_default = data.is_default

        if data.steps is not None:
            # Replace steps entirely
            self.db.query(ApprovalPolicyStep).filter(
                ApprovalPolicyStep.policy_id == policy_id
            ).delete()
            for step_data in sorted(data.steps, key=lambda s: s.step_order):
                self.db.add(ApprovalPolicyStep(
                    policy_id=policy_id,
                    step_order=step_data.step_order,
                    label=step_data.label,
                    approver_user_id=step_data.approver_user_id,
                    approver_role=step_data.approver_role,
                ))

        if data.escalation_rules is not None:
            self.db.query(ApprovalEscalationRule).filter(
                ApprovalEscalationRule.policy_id == policy_id
            ).delete()
            for rule_data in data.escalation_rules:
                self.db.add(ApprovalEscalationRule(
                    policy_id=policy_id,
                    condition_field=rule_data.condition_field,
                    condition_value=rule_data.condition_value,
                    add_step_label=rule_data.add_step_label,
                    add_step_user_id=rule_data.add_step_user_id,
                    add_step_role=rule_data.add_step_role,
                ))

        policy.updated_at = datetime.utcnow()
        self.db.commit()
        return self.get_policy(policy_id)

    def delete_policy(self, policy_id: int):
        policy = self.get_policy(policy_id)
        self.db.delete(policy)
        self.db.commit()


# ── Workflow management ──────────────────────────────────────────────────────

class ApprovalWorkflowService:

    def __init__(self, db: Session):
        self.db = db

    def _load_workflow(self, workflow_id: int) -> ApprovalWorkflow:
        wf = self.db.query(ApprovalWorkflow).options(
            joinedload(ApprovalWorkflow.steps).joinedload(ApprovalWorkflowStep.approver),
            joinedload(ApprovalWorkflow.steps).joinedload(ApprovalWorkflowStep.decider),
            joinedload(ApprovalWorkflow.creator),
        ).filter(ApprovalWorkflow.id == workflow_id).first()
        if not wf:
            raise HTTPException(404, "Approval workflow not found")
        return wf

    def get_for_entity(self, entity_type: str, entity_id: int) -> Optional[ApprovalWorkflow]:
        """Return the most recent workflow for a given entity, or None."""
        return self.db.query(ApprovalWorkflow).options(
            joinedload(ApprovalWorkflow.steps).joinedload(ApprovalWorkflowStep.approver),
            joinedload(ApprovalWorkflow.steps).joinedload(ApprovalWorkflowStep.decider),
            joinedload(ApprovalWorkflow.creator),
        ).filter(
            ApprovalWorkflow.entity_type == entity_type,
            ApprovalWorkflow.entity_id == entity_id,
        ).order_by(ApprovalWorkflow.created_at.desc()).first()

    def get_my_queue(self, user: User) -> list[ApprovalWorkflow]:
        """Pending workflows where the current user is the next approver."""
        pending_wfs = self.db.query(ApprovalWorkflow).options(
            joinedload(ApprovalWorkflow.steps).joinedload(ApprovalWorkflowStep.approver),
            joinedload(ApprovalWorkflow.steps).joinedload(ApprovalWorkflowStep.decider),
            joinedload(ApprovalWorkflow.creator),
        ).filter(ApprovalWorkflow.status == "pending").all()

        result = []
        for wf in pending_wfs:
            steps = sorted(wf.steps, key=lambda s: s.step_order)
            current = next((s for s in steps if s.step_order == wf.current_step), None)
            if current and self._user_can_decide(current, user):
                result.append(wf)
        return result

    def _user_can_decide(self, step: ApprovalWorkflowStep, user: User) -> bool:
        """Check if a user is allowed to decide a step."""
        if step.approver_user_id and step.approver_user_id == user.id:
            return True
        if step.approver_role and step.approver_role == user.role:
            return True
        # Admins can always decide
        if user.role == "admin":
            return True
        return False

    def create_workflow(
        self,
        policy_id: int,
        entity_type: str,
        entity_id: int,
        entity_data: dict,
        created_by_id: int,
    ) -> ApprovalWorkflow:
        """
        Instantiate a workflow from a policy, snapshot all steps,
        and apply escalation rules based on entity_data.
        """
        policy = ApprovalPolicyService(self.db).get_policy(policy_id)

        # Cancel any existing pending workflow for this entity
        existing = self.db.query(ApprovalWorkflow).filter(
            ApprovalWorkflow.entity_type == entity_type,
            ApprovalWorkflow.entity_id == entity_id,
            ApprovalWorkflow.status == "pending",
        ).first()
        if existing:
            existing.status = "cancelled"

        wf = ApprovalWorkflow(
            policy_id=policy_id,
            entity_type=entity_type,
            entity_id=entity_id,
            status="pending",
            current_step=1,
            created_by=created_by_id,
        )
        self.db.add(wf)
        self.db.flush()

        # Snapshot policy steps
        base_steps = sorted(policy.steps, key=lambda s: s.step_order)
        for step_data in base_steps:
            self.db.add(ApprovalWorkflowStep(
                workflow_id=wf.id,
                step_order=step_data.step_order,
                label=step_data.label,
                approver_user_id=step_data.approver_user_id,
                approver_role=step_data.approver_role,
                is_escalation=False,
                status="pending",
            ))

        # Apply escalation rules
        max_order = max((s.step_order for s in base_steps), default=0)
        for rule in policy.escalation_rules:
            field_val = entity_data.get(rule.condition_field, "")
            if str(field_val) == str(rule.condition_value):
                max_order += 1
                self.db.add(ApprovalWorkflowStep(
                    workflow_id=wf.id,
                    step_order=max_order,
                    label=rule.add_step_label,
                    approver_user_id=rule.add_step_user_id,
                    approver_role=rule.add_step_role,
                    is_escalation=True,
                    status="pending",
                ))

        # Set current_step to first step order
        if base_steps:
            wf.current_step = base_steps[0].step_order

        self.db.commit()
        loaded = self._load_workflow(wf.id)

        # ── Notify first-step approver ────────────────────────────────────────
        try:
            first_steps = sorted(loaded.steps, key=lambda s: s.step_order)
            if first_steps:
                first = first_steps[0]
                # Collect approver emails: specific user or all users with matching role
                approver_emails: list[tuple[str, str]] = []  # (email, display_name)
                if first.approver_user_id and first.approver:
                    approver_emails = [(first.approver.email, first.approver.display_name)]
                elif first.approver_role:
                    role_users = self.db.query(User).filter(
                        User.role == first.approver_role,
                        User.status == "active",
                    ).all()
                    approver_emails = [(u.email, u.display_name) for u in role_users]

                # Resolve entity name
                entity_name = _get_entity_display_name(self.db, entity_type, entity_id)
                creator = self.db.query(User).filter(User.id == created_by_id).first()
                requester_name = creator.display_name if creator else "A team member"

                for email_addr, approver_name in approver_emails:
                    subj, body = build_approval_request_email(
                        entity_type=entity_type,
                        entity_name=entity_name,
                        requester_name=requester_name,
                        step_label=first.label or "Review & Approve",
                        approver_name=approver_name,
                        workflow_id=loaded.id,
                    )
                    send_email(email_addr, subj, body)
        except Exception:
            pass  # never let email failure break the workflow creation

        return loaded

    def decide(
        self,
        workflow_id: int,
        req: ApprovalDecisionRequest,
        user: User,
    ) -> ApprovalWorkflow:
        """
        Process an approve or reject decision on the current step.
        Approve → advance to next step (or complete workflow).
        Reject  → reset current step to previous (or reject workflow if on step 1).
        """
        wf = self._load_workflow(workflow_id)

        if wf.status != "pending":
            raise HTTPException(400, f"Workflow is already {wf.status}")

        steps = sorted(wf.steps, key=lambda s: s.step_order)
        current = next((s for s in steps if s.step_order == wf.current_step), None)
        if not current:
            raise HTTPException(500, "Workflow step not found")

        if not self._user_can_decide(current, user):
            raise HTTPException(403, "You are not the assigned approver for this step")

        now = datetime.utcnow()

        if req.decision == "approved":
            current.status = "approved"
            current.decided_by_id = user.id
            current.decided_at = now
            current.notes = req.notes

            # Find next pending step
            remaining = [s for s in steps if s.step_order > wf.current_step]
            if remaining:
                wf.current_step = remaining[0].step_order
            else:
                # All steps done → approve workflow
                wf.status = "approved"
                wf.completed_at = now
                _sync_entity_status(self.db, wf.entity_type, wf.entity_id, "approved")

        elif req.decision == "rejected":
            current.status = "rejected"
            current.decided_by_id = user.id
            current.decided_at = now
            current.notes = req.notes

            previous = [s for s in steps if s.step_order < wf.current_step]
            if previous:
                prev = previous[-1]
                # Reset the previous step so it can be re-decided
                prev.status = "pending"
                prev.decided_by_id = None
                prev.decided_at = None
                prev.notes = None
                wf.current_step = prev.step_order
            else:
                # Rejected on first step → reject entire workflow
                wf.status = "rejected"
                wf.completed_at = now
                _sync_entity_status(self.db, wf.entity_type, wf.entity_id, "rejected")

        else:
            raise HTTPException(400, "decision must be 'approved' or 'rejected'")

        self.db.commit()
        return self._load_workflow(wf.id)
