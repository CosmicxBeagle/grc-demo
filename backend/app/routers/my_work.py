"""
My Work — prioritized work queue for the authenticated user.

GET /my-work/queue — returns a unified prioritized list of action items.
"""
from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.auth.local_auth import get_current_user
from app.auth.permissions import require_any_permission
from app.models.models import (
    User, TestAssignment, DeficiencyMilestone, RiskReviewRequest,
    ControlException, TestCycle,
)

router = APIRouter(prefix="/my-work", tags=["my-work"])


class WorkItem(BaseModel):
    item_type: str
    entity_id: int
    entity_type: str
    title: str
    due_date: Optional[str] = None
    days_overdue: Optional[int] = None
    urgency: str  # critical | high | medium | low
    url: str


def _days_overdue(due: Optional[date]) -> Optional[int]:
    if due is None:
        return None
    return (date.today() - due).days  # positive = overdue, negative = days remaining


def _urgency(days: Optional[int], escalation_level: int = 0) -> str:
    if escalation_level >= 2:
        return "critical"
    if escalation_level == 1:
        return "high"
    if days is None:
        return "low"
    if days > 7:
        return "critical"
    if 1 <= days <= 7:
        return "high"
    if -3 <= days < 1:
        return "high"
    if -7 <= days < -3:
        return "medium"
    return "low"


@router.get("/queue", response_model=List[WorkItem])
def get_work_queue(
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission(
        "tests:read",
        "deficiencies:read",
        "risks:read",
        "approvals:read",
        "exceptions:read",
    )),
):
    """Return a unified, urgency-sorted work queue for the current user."""
    items: List[WorkItem] = []
    today = date.today()
    is_manager = user.role in ("admin", "grc_manager", "grc_analyst", "reviewer")

    # ── Assignments to test (tester) ──────────────────────────────────────────
    tester_assignments = (
        db.query(TestAssignment)
        .options(joinedload(TestAssignment.control))
        .filter(
            TestAssignment.tester_id == user.id,
            TestAssignment.status.in_(["not_started", "in_progress"]),
        )
        .all()
    )
    for a in tester_assignments:
        ctrl = a.control
        title = f"Test: {ctrl.title if ctrl else f'Control #{a.control_id}'}"
        due = None  # assignments don't have standalone due dates
        days = _days_overdue(due)
        items.append(WorkItem(
            item_type="assignment_to_test",
            entity_id=a.id,
            entity_type="test_assignment",
            title=title,
            due_date=None,
            days_overdue=days,
            urgency=_urgency(days),
            url=f"/test-cycles/{a.test_cycle_id}?assignment={a.id}",
        ))

    # ── Assignments to review (reviewer) ──────────────────────────────────────
    if is_manager or user.role == "reviewer":
        review_assignments = (
            db.query(TestAssignment)
            .options(joinedload(TestAssignment.control))
            .filter(
                TestAssignment.reviewer_id == user.id,
                TestAssignment.status == "needs_review",
            )
            .all()
        )
        for a in review_assignments:
            ctrl = a.control
            title = f"Review: {ctrl.title if ctrl else f'Control #{a.control_id}'}"
            items.append(WorkItem(
                item_type="assignment_to_review",
                entity_id=a.id,
                entity_type="test_assignment",
                title=title,
                due_date=None,
                days_overdue=None,
                urgency="high",
                url=f"/test-cycles/{a.test_cycle_id}?assignment={a.id}",
            ))

    # ── Overdue deficiency milestones ─────────────────────────────────────────
    milestones = (
        db.query(DeficiencyMilestone)
        .options(joinedload(DeficiencyMilestone.deficiency))
        .filter(
            DeficiencyMilestone.assignee_id == user.id,
            DeficiencyMilestone.status.notin_(["completed"]),
        )
        .all()
    )
    for m in milestones:
        due = m.due_date
        days = _days_overdue(due)
        def_name = m.deficiency.title if m.deficiency else f"Deficiency #{m.deficiency_id}"
        items.append(WorkItem(
            item_type="deficiency_milestone_due",
            entity_id=m.id,
            entity_type="deficiency_milestone",
            title=f"Milestone: {m.title} ({def_name})",
            due_date=due.isoformat() if due else None,
            days_overdue=days,
            urgency=_urgency(days, m.escalation_level),
            url=f"/deficiencies?id={m.deficiency_id}",
        ))

    # ── Risk review requests ───────────────────────────────────────────────────
    review_requests = (
        db.query(RiskReviewRequest)
        .filter(
            RiskReviewRequest.owner_id == user.id,
            RiskReviewRequest.status == "pending",
        )
        .all()
    )
    for rr in review_requests:
        items.append(WorkItem(
            item_type="risk_review_pending",
            entity_id=rr.id,
            entity_type="risk_review_request",
            title=f"Risk Review: Risk #{rr.risk_id}",
            due_date=None,
            days_overdue=None,
            urgency="medium",
            url=f"/risk-reviews/{rr.cycle_id}",
        ))

    # ── Exception pending approval (for approvers) ────────────────────────────
    if is_manager:
        pending_exceptions = (
            db.query(ControlException)
            .filter(ControlException.status == "pending_approval")
            .all()
        )
        for exc in pending_exceptions:
            title_str = exc.title or f"Exception #{exc.id}"
            items.append(WorkItem(
                item_type="exception_pending_approval",
                entity_id=exc.id,
                entity_type="control_exception",
                title=f"Approve Exception: {title_str}",
                due_date=None,
                days_overdue=None,
                urgency="high",
                url=f"/exceptions?id={exc.id}",
            ))

    # ── Extension requests pending (for managers) ─────────────────────────────
    if is_manager:
        extension_milestones = (
            db.query(DeficiencyMilestone)
            .filter(
                DeficiencyMilestone.extension_requested == True,
                DeficiencyMilestone.extension_approved.is_(None),
            )
            .all()
        )
        for m in extension_milestones:
            items.append(WorkItem(
                item_type="extension_request_pending",
                entity_id=m.id,
                entity_type="deficiency_milestone",
                title=f"Extension Request: {m.title}",
                due_date=m.due_date.isoformat() if m.due_date else None,
                days_overdue=_days_overdue(m.due_date),
                urgency="medium",
                url=f"/deficiencies?id={m.deficiency_id}",
            ))

    # Sort by urgency
    URGENCY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    items.sort(key=lambda x: URGENCY_ORDER.get(x.urgency, 99))
    return items
