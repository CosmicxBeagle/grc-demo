"""Tests for exception_lifecycle_service — Workstream 4B."""
import pytest
import datetime
from unittest.mock import patch

from fastapi import HTTPException
from app.services.exception_lifecycle_service import (
    on_exception_approved,
    on_exception_rejected,
    resubmit_exception,
    run_exception_lifecycle,
)
from app.models.models import ControlException, Control, Notification
from tests.conftest import make_user


def make_control(db):
    now = datetime.datetime.utcnow()
    ctrl = Control(
        control_id="C-1", title="Control 1", status="active",
        sox_in_scope=False, created_at=now, updated_at=now,
    )
    db.add(ctrl)
    db.flush()
    return ctrl


def make_exception(db, *, requester_id, control_id, status="draft", expires_at=None,
                   expiry_notified_at=None, expired_at=None, resubmission_count=0):
    now = datetime.datetime.utcnow()
    exc = ControlException(
        control_id=control_id,
        title="Test Exception",
        exception_type="compensating_control",
        justification="Business need X requires Y",
        risk_level="medium",
        status=status,
        requested_by=requester_id,
        expires_at=expires_at,
        expiry_notified_at=expiry_notified_at,
        expired_at=expired_at,
        resubmission_count=resubmission_count,
        created_at=now,
        updated_at=now,
    )
    db.add(exc)
    db.flush()
    return exc


class TestOnExceptionApproved:
    def test_sets_expires_at(self, db):
        requester = make_user(db, role="tester")
        ctrl = make_control(db)
        exc = make_exception(db, requester_id=requester.id, control_id=ctrl.id)

        with patch("app.services.exception_lifecycle_service.send_email"):
            on_exception_approved(db, exc, requester, requested_duration_days=90)

        assert exc.expires_at is not None
        # Should be roughly 90 days from now
        delta = exc.expires_at - datetime.datetime.utcnow()
        assert 88 <= delta.days <= 91

    def test_notification_created(self, db):
        requester = make_user(db, role="tester")
        ctrl = make_control(db)
        exc = make_exception(db, requester_id=requester.id, control_id=ctrl.id)

        with patch("app.services.exception_lifecycle_service.send_email"):
            on_exception_approved(db, exc, requester, requested_duration_days=365)

        notifs = db.query(Notification).filter_by(user_id=requester.id).all()
        assert len(notifs) >= 1
        assert "approved" in notifs[0].message


class TestOnExceptionRejected:
    def test_sets_rejection_reason(self, db):
        requester = make_user(db, role="tester")
        ctrl = make_control(db)
        exc = make_exception(db, requester_id=requester.id, control_id=ctrl.id)

        with patch("app.services.exception_lifecycle_service.send_email"):
            on_exception_rejected(db, exc, requester, "Insufficient justification provided")

        assert exc.rejection_reason == "Insufficient justification provided"
        assert exc.decision_notified_at is not None


class TestResubmitException:
    def test_creates_linked_exception(self, db):
        requester = make_user(db, role="tester")
        ctrl = make_control(db)
        exc = make_exception(db, requester_id=requester.id, control_id=ctrl.id, status="rejected")

        new_exc = resubmit_exception(db, exc, requester)

        assert new_exc.parent_exception_id == exc.id
        assert new_exc.status == "draft"
        assert new_exc.resubmission_count == 1

    def test_only_rejected_can_resubmit(self, db):
        requester = make_user(db, role="tester")
        ctrl = make_control(db)
        exc = make_exception(db, requester_id=requester.id, control_id=ctrl.id, status="approved")

        with pytest.raises(HTTPException) as exc_info:
            resubmit_exception(db, exc, requester)
        assert exc_info.value.status_code == 400


class TestRunExceptionLifecycle:
    def test_warns_expiring_soon(self, db):
        requester = make_user(db, role="tester")
        ctrl = make_control(db)
        expires_soon = datetime.datetime.utcnow() + datetime.timedelta(days=20)
        exc = make_exception(
            db, requester_id=requester.id, control_id=ctrl.id,
            status="approved", expires_at=expires_soon,
        )

        with patch("app.services.exception_lifecycle_service.send_email"):
            result = run_exception_lifecycle(db)

        assert result["warned"] >= 1
        assert exc.expiry_notified_at is not None

    def test_marks_expired(self, db):
        requester = make_user(db, role="tester")
        ctrl = make_control(db)
        already_expired = datetime.datetime.utcnow() - datetime.timedelta(days=1)
        exc = make_exception(
            db, requester_id=requester.id, control_id=ctrl.id,
            status="approved", expires_at=already_expired,
        )

        with patch("app.services.exception_lifecycle_service.send_email"):
            result = run_exception_lifecycle(db)

        assert result["expired"] >= 1
        assert exc.status == "expired"
        assert exc.expired_at is not None

    def test_no_double_warn(self, db):
        requester = make_user(db, role="tester")
        ctrl = make_control(db)
        expires_soon = datetime.datetime.utcnow() + datetime.timedelta(days=20)
        exc = make_exception(
            db, requester_id=requester.id, control_id=ctrl.id,
            status="approved", expires_at=expires_soon,
            expiry_notified_at=datetime.datetime.utcnow(),  # already warned
        )

        with patch("app.services.exception_lifecycle_service.send_email"):
            result = run_exception_lifecycle(db)

        assert result["warned"] == 0
