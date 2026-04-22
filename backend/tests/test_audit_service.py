from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.models import Base, AuditLog, User
from app.services import services as services_module


def test_audit_log_commit_does_not_commit_caller_session(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    monkeypatch.setattr(services_module, "SessionLocal", Session)

    seed = Session()
    seed_user = User(
        username="audit@example.com",
        display_name="Original Name",
        email="audit@example.com",
        role="admin",
        identity_provider="local",
        status="active",
    )
    seed.add(seed_user)
    seed.commit()
    seed.close()

    caller_db = Session()
    actor = caller_db.query(User).filter(User.email == "audit@example.com").first()
    actor.display_name = "Changed But Uncommitted"

    services_module.AuditService(caller_db).log("TEST_AUDIT", actor=actor)

    verifier = Session()
    persisted_user = verifier.query(User).filter(User.email == "audit@example.com").first()
    audit_rows = verifier.query(AuditLog).filter(AuditLog.action == "TEST_AUDIT").all()

    assert persisted_user.display_name == "Original Name"
    assert len(audit_rows) == 1

    caller_db.close()
    verifier.close()
    Base.metadata.drop_all(engine)
