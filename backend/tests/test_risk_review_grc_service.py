"""Tests for risk_review_grc_service — Workstream 4C."""
import pytest
import datetime
from unittest.mock import patch

from fastapi import HTTPException
from app.services.risk_review_grc_service import accept_update, challenge_update, respond_to_challenge
from app.models.models import (
    Risk, Asset, Threat, RiskReviewRequest, RiskReviewUpdate, Notification,
)
from tests.conftest import make_user


def make_risk(db, *, owner_id):
    now = datetime.datetime.utcnow()
    asset = Asset(name="Server", asset_type="infrastructure", criticality="high", created_at=now, updated_at=now)
    db.add(asset)
    db.flush()
    threat = Threat(name="Breach", threat_category="cyber", source="external", created_at=now, updated_at=now)
    db.add(threat)
    db.flush()
    risk = Risk(
        name="Test Risk",
        asset_id=asset.id,
        threat_id=threat.id,
        owner_id=owner_id,
        likelihood=3,
        impact=3,
        status="open",
        created_at=now,
        updated_at=now,
    )
    db.add(risk)
    db.flush()
    return risk


def make_review_update(db, *, owner_id, reviewer_id=None, grc_status="pending_review"):
    now = datetime.datetime.utcnow()
    risk = make_risk(db, owner_id=owner_id)
    # Need a cycle first
    from app.models.models import RiskReviewCycle
    cycle = RiskReviewCycle(
        label="Test Cycle", cycle_type="quarterly", status="active", created_at=now,
    )
    db.add(cycle)
    db.flush()
    req = RiskReviewRequest(
        cycle_id=cycle.id,
        risk_id=risk.id,
        owner_id=owner_id,
        status="pending",
        created_at=now,
    )
    db.add(req)
    db.flush()

    upd = RiskReviewUpdate(
        request_id=req.id,
        risk_id=risk.id,
        cycle_id=cycle.id,
        submitted_by=owner_id,
        notes="Score reduced after new control",
        grc_review_status=grc_status,
        submitted_at=now,
    )
    db.add(upd)
    db.flush()
    return upd


class TestAcceptUpdate:
    def test_accept_pending_update(self, db):
        owner = make_user(db, role="tester")
        reviewer = make_user(db, role="grc_manager", email="grc@example.com")
        upd = make_review_update(db, owner_id=owner.id)

        result = accept_update(db, upd.id, reviewer)

        assert result.grc_review_status == "accepted"
        assert result.grc_reviewer_user_id == reviewer.id
        assert result.grc_reviewed_at is not None

    def test_cannot_accept_already_accepted(self, db):
        owner = make_user(db, role="tester")
        reviewer = make_user(db, role="grc_manager", email="grc@example.com")
        upd = make_review_update(db, owner_id=owner.id, grc_status="accepted")

        with pytest.raises(HTTPException) as exc_info:
            accept_update(db, upd.id, reviewer)
        assert exc_info.value.status_code == 400


class TestChallengeUpdate:
    def test_challenge_notifies_owner(self, db):
        owner = make_user(db, role="tester")
        reviewer = make_user(db, role="grc_manager", email="grc@example.com")
        upd = make_review_update(db, owner_id=owner.id)

        with patch("app.services.risk_review_grc_service.send_email"):
            result = challenge_update(db, upd.id, reviewer, "Score reduction not supported by evidence")

        assert result.grc_review_status == "challenged"
        assert result.grc_challenge_reason == "Score reduction not supported by evidence"
        notifs = db.query(Notification).filter_by(user_id=owner.id).all()
        assert len(notifs) >= 1


class TestRespondToChallenge:
    def test_response_stored(self, db):
        owner = make_user(db, role="tester")
        reviewer = make_user(db, role="grc_manager", email="grc@example.com")
        upd = make_review_update(db, owner_id=owner.id, grc_status="challenged")
        upd.grc_reviewer_user_id = reviewer.id
        db.flush()

        result = respond_to_challenge(db, upd.id, owner, "Evidence has been uploaded to the evidence library")

        assert result.owner_challenge_response == "Evidence has been uploaded to the evidence library"
        assert result.owner_responded_at is not None

    def test_cannot_respond_to_pending(self, db):
        owner = make_user(db, role="tester")
        upd = make_review_update(db, owner_id=owner.id, grc_status="pending_review")

        with pytest.raises(HTTPException) as exc_info:
            respond_to_challenge(db, upd.id, owner, "some response")
        assert exc_info.value.status_code == 400
