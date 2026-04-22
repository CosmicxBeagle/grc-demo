"""Tests for milestone_escalation_service — Loop 3."""
import pytest
from datetime import date, timedelta
from unittest.mock import patch

from app.services.milestone_escalation_service import (
    run_milestone_escalations,
    request_extension,
    approve_extension,
    reject_extension,
)
from app.models.models import DeficiencyMilestone, Deficiency, Notification
from tests.conftest import make_user


def make_deficiency(db, *, title="Test Deficiency"):
    from app.models.models import Control
    import datetime
    ctrl = Control(control_id="C-1", title="Control 1", status="active", sox_in_scope=False, created_at=datetime.datetime.utcnow(), updated_at=datetime.datetime.utcnow())
    db.add(ctrl)
    db.flush()
    d = Deficiency(
        assignment_id=0,  # no real assignment needed for milestone tests
        title=title,
        severity="high",
        status="open",
        created_at=datetime.datetime.utcnow(),
        updated_at=datetime.datetime.utcnow(),
    )
    db.add(d)
    db.flush()
    return d


def make_milestone(db, *, deficiency_id, due_date, assignee_id=None, status="open", escalation_level=0):
    import datetime
    m = DeficiencyMilestone(
        deficiency_id=deficiency_id,
        title="Test Milestone",
        due_date=due_date,
        assignee_id=assignee_id,
        status=status,
        escalation_level=escalation_level,
        extension_requested=False,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(m)
    db.flush()
    return m


class TestRunMilestoneEscalations:
    def test_escalates_level_0_to_1(self, db):
        assignee = make_user(db, role="tester", email="tester@example.com")
        d = make_deficiency(db)
        overdue_date = date.today() - timedelta(days=5)
        m = make_milestone(db, deficiency_id=d.id, due_date=overdue_date, assignee_id=assignee.id)

        with patch("app.services.milestone_escalation_service.send_email"):
            result = run_milestone_escalations(db)

        assert result["level_1_escalations"] == 1
        assert m.escalation_level == 1
        assert m.status == "overdue"

    def test_escalates_level_1_to_2(self, db):
        manager = make_user(db, role="grc_manager", email="mgr@example.com")
        assignee = make_user(db, role="tester", email="tester@example.com")
        d = make_deficiency(db)
        overdue_date = date.today() - timedelta(days=10)
        m = make_milestone(db, deficiency_id=d.id, due_date=overdue_date, assignee_id=assignee.id, status="overdue", escalation_level=1)

        with patch("app.services.milestone_escalation_service.send_email"):
            result = run_milestone_escalations(db)

        assert result["level_2_escalations"] == 1
        assert m.escalation_level == 2
        notifications = db.query(Notification).filter_by(user_id=manager.id).all()
        assert len(notifications) >= 1

    def test_does_not_escalate_completed(self, db):
        d = make_deficiency(db)
        overdue_date = date.today() - timedelta(days=5)
        m = make_milestone(db, deficiency_id=d.id, due_date=overdue_date, status="completed")

        result = run_milestone_escalations(db)
        assert result["level_1_escalations"] == 0
        assert m.escalation_level == 0

    def test_does_not_escalate_future_due(self, db):
        d = make_deficiency(db)
        future = date.today() + timedelta(days=5)
        m = make_milestone(db, deficiency_id=d.id, due_date=future)

        result = run_milestone_escalations(db)
        assert result["level_1_escalations"] == 0


class TestExtensionWorkflow:
    def test_request_extension_sets_flag(self, db):
        manager = make_user(db, role="grc_manager", email="mgr@example.com")
        requestor = make_user(db, role="tester", email="tester@example.com")
        d = make_deficiency(db)
        m = make_milestone(db, deficiency_id=d.id, due_date=date.today())

        with patch("app.services.milestone_escalation_service.send_email"):
            request_extension(db, m, requestor, "Need two more weeks for remediation")

        assert m.extension_requested is True
        assert m.extension_approved is None
        assert m.original_due_date == date.today()

    def test_approve_extension_sets_new_date(self, db):
        approver = make_user(db, role="admin", email="admin@example.com")
        requestor = make_user(db, role="tester", email="tester@example.com")
        d = make_deficiency(db)
        m = make_milestone(db, deficiency_id=d.id, due_date=date.today())
        m.extension_requested = True
        m.extension_approved = None
        db.flush()

        new_date = date.today() + timedelta(days=14)
        approve_extension(db, m, approver, new_date)

        assert m.extension_approved is True
        assert m.due_date == new_date
        assert m.new_due_date == new_date

    def test_reject_extension(self, db):
        approver = make_user(db, role="admin", email="admin@example.com")
        d = make_deficiency(db)
        m = make_milestone(db, deficiency_id=d.id, due_date=date.today())
        m.extension_requested = True
        m.extension_approved = None
        db.flush()

        reject_extension(db, m, approver)
        assert m.extension_approved is False

    def test_approve_when_no_pending_raises(self, db):
        from fastapi import HTTPException
        approver = make_user(db, role="admin", email="admin@example.com")
        d = make_deficiency(db)
        m = make_milestone(db, deficiency_id=d.id, due_date=date.today())
        # No pending request

        with pytest.raises(HTTPException) as exc_info:
            approve_extension(db, m, approver, date.today() + timedelta(days=7))
        assert exc_info.value.status_code == 400
