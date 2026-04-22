"""Tests for retest_service — Workstream 4A."""
import pytest
import datetime
from unittest.mock import patch

from fastapi import HTTPException
from app.services.retest_service import assert_can_close, create_retest_assignment, waive_retest
from app.models.models import Deficiency, TestAssignment, TestCycle, Control
from tests.conftest import make_user, make_assignment


def make_deficiency(db, *, assignment_id, retest_required=True, retest_waived=False,
                    retest_assignment_id=None, status="open"):
    now = datetime.datetime.utcnow()
    d = Deficiency(
        assignment_id=assignment_id,
        title="Test Deficiency",
        severity="high",
        status=status,
        retest_required=retest_required,
        retest_waived=retest_waived,
        retest_assignment_id=retest_assignment_id,
        created_at=now,
        updated_at=now,
    )
    db.add(d)
    db.flush()
    return d


class TestAssertCanClose:
    def test_no_retest_required_passes(self, db):
        tester = make_user(db, role="tester")
        a = make_assignment(db, tester_id=tester.id)
        d = make_deficiency(db, assignment_id=a.id, retest_required=False)
        # Should not raise
        assert_can_close(d)

    def test_waived_passes(self, db):
        tester = make_user(db, role="tester")
        a = make_assignment(db, tester_id=tester.id)
        d = make_deficiency(db, assignment_id=a.id, retest_required=True, retest_waived=True)
        assert_can_close(d)

    def test_no_retest_assignment_raises(self, db):
        tester = make_user(db, role="tester")
        a = make_assignment(db, tester_id=tester.id)
        d = make_deficiency(db, assignment_id=a.id, retest_required=True)
        with pytest.raises(HTTPException) as exc_info:
            assert_can_close(d)
        assert exc_info.value.status_code == 422
        assert "re-test assignment is required" in exc_info.value.detail


class TestCreateRetestAssignment:
    def test_creates_assignment_and_links(self, db):
        tester = make_user(db, role="tester")
        a = make_assignment(db, tester_id=tester.id)
        d = make_deficiency(db, assignment_id=a.id)

        cycle = db.query(TestCycle).first()
        retest = create_retest_assignment(db, d, cycle.id, tester.id, tester)

        assert retest.is_retest is True
        assert retest.retest_for_deficiency_id == d.id
        assert d.retest_assignment_id == retest.id
        assert retest.status == "not_started"

    def test_invalid_cycle_raises(self, db):
        tester = make_user(db, role="tester")
        a = make_assignment(db, tester_id=tester.id)
        d = make_deficiency(db, assignment_id=a.id)

        with pytest.raises(HTTPException) as exc_info:
            create_retest_assignment(db, d, cycle_id=9999, assigned_to_user_id=tester.id, created_by=tester)
        assert exc_info.value.status_code == 404


class TestWaiveRetest:
    def test_waive_sets_fields(self, db):
        tester = make_user(db, role="tester")
        admin = make_user(db, role="admin", email="admin@example.com")
        a = make_assignment(db, tester_id=tester.id)
        d = make_deficiency(db, assignment_id=a.id)

        waive_retest(db, d, "Risk accepted by management due to compensating controls", admin)

        assert d.retest_waived is True
        assert d.retest_waived_by_user_id == admin.id
        assert "compensating controls" in d.retest_waived_reason
