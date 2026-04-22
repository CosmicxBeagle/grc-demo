"""Tests for rework_service — Loop 1."""
import pytest
from unittest.mock import patch

from app.services.rework_service import (
    REWORK_ESCALATION_THRESHOLD,
    process_return_for_rework,
)
from app.models.models import AssignmentReworkLog, Notification
from tests.conftest import make_user, make_assignment


def test_increments_rework_count(db):
    reviewer = make_user(db, role="reviewer")
    a = make_assignment(db, reviewer_id=reviewer.id)
    assert a.rework_count == 0

    process_return_for_rework(db, a, reviewer, "Needs major corrections here")
    assert a.rework_count == 1
    assert a.last_return_reason == "Needs major corrections here"
    assert a.last_returned_at is not None


def test_creates_log_entry(db):
    reviewer = make_user(db, role="reviewer")
    a = make_assignment(db, reviewer_id=reviewer.id)

    process_return_for_rework(db, a, reviewer, "Missing evidence documentation")
    db.flush()

    logs = db.query(AssignmentReworkLog).filter_by(assignment_id=a.id).all()
    assert len(logs) == 1
    assert logs[0].rework_number == 1
    assert logs[0].return_reason == "Missing evidence documentation"
    assert logs[0].returned_by_user_id == reviewer.id


def test_second_return_increments_to_2(db):
    reviewer = make_user(db, role="reviewer")
    a = make_assignment(db, reviewer_id=reviewer.id)

    process_return_for_rework(db, a, reviewer, "First return reason here")
    process_return_for_rework(db, a, reviewer, "Second return reason here")

    assert a.rework_count == 2
    logs = db.query(AssignmentReworkLog).filter_by(assignment_id=a.id).all()
    assert len(logs) == 2
    assert logs[1].rework_number == 2


def test_escalation_not_triggered_below_threshold(db):
    reviewer = make_user(db, role="reviewer")
    a = make_assignment(db, reviewer_id=reviewer.id)

    for i in range(REWORK_ESCALATION_THRESHOLD - 1):
        process_return_for_rework(db, a, reviewer, f"Return reason #{i + 1} needs fixing")

    db.flush()
    notifications = db.query(Notification).all()
    assert len(notifications) == 0


def test_escalation_triggered_at_threshold(db):
    manager = make_user(db, role="grc_manager", display_name="GRC Manager", email="mgr@example.com")
    reviewer = make_user(db, role="reviewer", display_name="Reviewer", email="rev@example.com")
    a = make_assignment(db, reviewer_id=reviewer.id)

    with patch("app.services.rework_service.send_email") as mock_email:
        for i in range(REWORK_ESCALATION_THRESHOLD):
            process_return_for_rework(db, a, reviewer, f"Return reason #{i + 1} needs fixing")

        db.flush()
        # Notification should have been created for the manager
        notifications = db.query(Notification).filter_by(user_id=manager.id).all()
        assert len(notifications) == 1
        assert "3 time(s)" in notifications[0].message

        # Email should have been sent
        assert mock_email.called
        assert mock_email.call_args[0][0] == "mgr@example.com"
