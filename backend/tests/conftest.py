"""Shared test fixtures for in-memory SQLite DB."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import Base


@pytest.fixture(scope="function")
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


def make_user(db, *, role="reviewer", display_name="Test User", email="test@example.com", user_id=None):
    from app.models.models import User
    u = User(
        username=email,
        display_name=display_name,
        email=email,
        role=role,
        identity_provider="local",
        status="active",
    )
    if user_id:
        u.id = user_id
    db.add(u)
    db.flush()
    return u


def make_assignment(db, *, control_id=1, tester_id=None, reviewer_id=None):
    from app.models.models import TestAssignment, TestCycle, Control
    # Minimal control
    ctrl = db.query(Control).filter(Control.id == control_id).first()
    if not ctrl:
        ctrl = Control(id=control_id, control_id=f"C-{control_id}", title=f"Control {control_id}", status="active", sox_in_scope=False, created_at=__import__('datetime').datetime.utcnow(), updated_at=__import__('datetime').datetime.utcnow())
        db.add(ctrl)
        db.flush()
    # Minimal cycle
    cycle = TestCycle(name="Test Cycle", status="active", created_by=1, created_at=__import__('datetime').datetime.utcnow())
    db.add(cycle)
    db.flush()
    a = TestAssignment(
        test_cycle_id=cycle.id,
        control_id=control_id,
        tester_id=tester_id,
        reviewer_id=reviewer_id,
        status="needs_review",
        rework_count=0,
        reopen_count=0,
        created_at=__import__('datetime').datetime.utcnow(),
        updated_at=__import__('datetime').datetime.utcnow(),
    )
    db.add(a)
    db.flush()
    return a
