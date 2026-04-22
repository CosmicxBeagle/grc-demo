"""Tests for evidence_reopen_service — Loop 2."""
import pytest
from unittest.mock import patch

from app.services.evidence_reopen_service import (
    REOPEN_ESCALATION_THRESHOLD,
    process_evidence_reopen,
    record_evidence_history,
)
from app.models.models import EvidenceRequestHistory, Notification
from tests.conftest import make_user, make_assignment


def test_increments_reopen_count(db):
    actor = make_user(db, role="reviewer")
    a = make_assignment(db, reviewer_id=actor.id)
    assert a.reopen_count == 0

    process_evidence_reopen(db, a, actor, "Evidence is incomplete and unclear")
    assert a.reopen_count == 1
    assert a.last_reopen_reason == "Evidence is incomplete and unclear"
    assert a.last_reopened_at is not None


def test_creates_history_entry(db):
    actor = make_user(db, role="reviewer")
    a = make_assignment(db, reviewer_id=actor.id)

    process_evidence_reopen(db, a, actor, "Screenshots are missing context")
    db.flush()

    history = db.query(EvidenceRequestHistory).filter_by(assignment_id=a.id).all()
    assert len(history) == 1
    assert history[0].action == "reopened"
    assert history[0].actor_user_id == actor.id
    assert "missing context" in history[0].reason


def test_escalation_triggered_at_threshold(db):
    manager = make_user(db, role="admin", display_name="Admin", email="admin@example.com")
    actor = make_user(db, role="reviewer", display_name="Reviewer", email="rev@example.com")
    a = make_assignment(db, reviewer_id=actor.id)

    with patch("app.services.evidence_reopen_service.send_email") as mock_email:
        for i in range(REOPEN_ESCALATION_THRESHOLD):
            process_evidence_reopen(db, a, actor, f"Reopen reason #{i + 1} insufficient")

        db.flush()
        notifications = db.query(Notification).filter_by(user_id=manager.id).all()
        assert len(notifications) == 1
        assert mock_email.called


def test_record_evidence_history(db):
    actor = make_user(db, role="tester")
    a = make_assignment(db)

    entry = record_evidence_history(db, a.id, "fulfilled", actor_user_id=actor.id)
    db.flush()

    assert entry.action == "fulfilled"
    assert entry.assignment_id == a.id
