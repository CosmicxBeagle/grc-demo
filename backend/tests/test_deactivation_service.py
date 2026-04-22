"""Tests for deactivation_service — Workstream 5A."""
import pytest
import datetime
from fastapi import HTTPException

from app.services.deactivation_service import (
    get_open_work_summary,
    bulk_reassign,
    deactivate_user,
)
from app.models.models import TestAssignment, DeficiencyMilestone
from tests.conftest import make_user, make_assignment


def make_milestone(db, *, assignee_id, status="open"):
    import datetime as dt
    from app.models.models import Deficiency, Control
    now = dt.datetime.utcnow()
    ctrl = Control(
        control_id="C-99", title="C99", status="active", sox_in_scope=False,
        created_at=now, updated_at=now,
    )
    db.add(ctrl)
    db.flush()
    d = Deficiency(
        assignment_id=0,
        title="Deficiency",
        severity="low",
        status="open",
        created_at=now,
        updated_at=now,
    )
    db.add(d)
    db.flush()
    m = DeficiencyMilestone(
        deficiency_id=d.id,
        title="Milestone",
        status=status,
        assignee_id=assignee_id,
        escalation_level=0,
        extension_requested=False,
        created_at=now,
    )
    db.add(m)
    db.flush()
    return m


class TestGetOpenWorkSummary:
    def test_counts_open_work(self, db):
        tester = make_user(db, role="tester")
        a = make_assignment(db, tester_id=tester.id)
        make_milestone(db, assignee_id=tester.id)

        summary = get_open_work_summary(db, tester.id)

        assert summary["open_assignments"] >= 1
        assert summary["open_milestones"] >= 1
        assert summary["total"] >= 2

    def test_completed_work_not_counted(self, db):
        tester = make_user(db, role="tester")
        make_milestone(db, assignee_id=tester.id, status="completed")

        summary = get_open_work_summary(db, tester.id)
        assert summary["open_milestones"] == 0


class TestBulkReassign:
    def test_reassigns_assignments(self, db):
        tester = make_user(db, role="tester")
        new_tester = make_user(db, role="tester", email="new@example.com")
        a = make_assignment(db, tester_id=tester.id)

        result = bulk_reassign(db, tester.id, new_tester.id)

        assert result["assignments"] >= 1
        db.refresh(a)
        assert a.tester_id == new_tester.id

    def test_reassign_to_inactive_raises(self, db):
        tester = make_user(db, role="tester")
        inactive = make_user(db, role="tester", email="inactive@example.com")
        inactive.deactivated_at = datetime.datetime.utcnow()
        db.flush()

        with pytest.raises(HTTPException) as exc_info:
            bulk_reassign(db, tester.id, inactive.id)
        assert exc_info.value.status_code == 404


class TestDeactivateUser:
    def test_deactivate_no_open_work(self, db):
        admin = make_user(db, role="admin")
        target = make_user(db, role="tester", email="target@example.com")

        result = deactivate_user(db, target, admin, "Left company")

        assert result["deactivated"] is True
        assert target.deactivated_at is not None
        assert target.status == "inactive"

    def test_deactivate_with_open_work_requires_reassign(self, db):
        admin = make_user(db, role="admin")
        target = make_user(db, role="tester", email="target@example.com")
        make_assignment(db, tester_id=target.id)

        with pytest.raises(HTTPException) as exc_info:
            deactivate_user(db, target, admin, "Left company")
        assert exc_info.value.status_code == 422
        assert "open_work" in exc_info.value.detail

    def test_deactivate_with_reassign_succeeds(self, db):
        admin = make_user(db, role="admin")
        target = make_user(db, role="tester", email="target@example.com")
        new_owner = make_user(db, role="tester", email="new@example.com")
        a = make_assignment(db, tester_id=target.id)

        result = deactivate_user(db, target, admin, "Left company", reassign_to_user_id=new_owner.id)

        assert result["deactivated"] is True
        assert result["reassigned"]["assignments"] >= 1
        db.refresh(a)
        assert a.tester_id == new_owner.id
