from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.local_auth import encode_token
from app.db.database import get_db
from app.models.models import Notification
from app.routers.notifications import router as notifications_router


def test_notifications_me_allows_viewer(db):
    from .conftest import make_user

    user = make_user(db, role="viewer", display_name="Viewer User", email="viewer@example.com")
    db.add(
        Notification(
            user_id=user.id,
            message="Test notification",
            is_read=False,
            created_at=datetime.utcnow(),
        )
    )
    db.commit()

    app = FastAPI()
    app.include_router(notifications_router, prefix="/v1")
    app.dependency_overrides[get_db] = lambda: db

    client = TestClient(app)
    token = encode_token(user.id, user.username, user.role)
    response = client.get("/v1/notifications/me", cookies={"session": token})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["message"] == "Test notification"


def test_notifications_me_blocks_role_without_permissions(db):
    from .conftest import make_user

    user = make_user(db, role="guest", display_name="Guest User", email="guest-notify@example.com")

    app = FastAPI()
    app.include_router(notifications_router, prefix="/v1")
    app.dependency_overrides[get_db] = lambda: db

    client = TestClient(app)
    token = encode_token(user.id, user.username, user.role)
    response = client.get("/v1/notifications/me", cookies={"session": token})

    assert response.status_code == 403
    assert "does not have any of the required permissions" in response.json()["detail"]
