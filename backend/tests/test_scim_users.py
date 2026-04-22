from fastapi import FastAPI
from fastapi.testclient import TestClient
from types import SimpleNamespace
from unittest.mock import patch

from app.db.database import get_db
from app.routers.scim import router as scim_router


def test_scim_create_user_requires_bearer_token(db):
    from app.auth import scim
    from app.config import Settings

    app = FastAPI()
    app.include_router(scim_router)
    app.dependency_overrides[get_db] = lambda: db

    original_settings = scim.settings
    try:
        scim.settings = Settings(scim_token="secret-token")
        client = TestClient(app)
        response = client.post(
            "/scim/v2/Users",
            json={"userName": "alice@example.com", "emails": [{"value": "alice@example.com", "primary": True}]},
        )
    finally:
        scim.settings = original_settings

    assert response.status_code == 401


def test_scim_create_user_creates_active_user(db):
    from app.auth import scim
    from app.config import Settings

    app = FastAPI()
    app.include_router(scim_router)
    app.dependency_overrides[get_db] = lambda: db

    original_settings = scim.settings
    try:
        scim.settings = Settings(scim_token="secret-token")
        client = TestClient(app)
        fake_user = SimpleNamespace(
            id=123,
            username="alice@example.com",
            display_name="Alice Example",
            email="alice@example.com",
            status="active",
        )
        with patch("app.routers.scim.UserService.create_scim_user", return_value=fake_user):
            response = client.post(
                "/scim/v2/Users",
                headers={"Authorization": "Bearer secret-token"},
                json={
                    "userName": "alice@example.com",
                    "displayName": "Alice Example",
                    "emails": [{"value": "alice@example.com", "primary": True}],
                    "externalId": "sailpoint-123",
                    "department": "Security",
                    "title": "Analyst",
                    "active": True,
                },
            )
    finally:
        scim.settings = original_settings

    assert response.status_code == 201
    body = response.json()
    assert body["userName"] == "alice@example.com"
    assert body["displayName"] == "Alice Example"
    assert body["active"] is True
    assert body["emails"][0]["value"] == "alice@example.com"


def test_scim_patch_user_updates_role_and_active(db):
    from app.auth import scim
    from app.config import Settings

    app = FastAPI()
    app.include_router(scim_router)
    app.dependency_overrides[get_db] = lambda: db

    original_settings = scim.settings
    try:
        scim.settings = Settings(scim_token="secret-token")
        client = TestClient(app)
        fake_user = SimpleNamespace(
            id=123,
            username="alice@example.com",
            display_name="Alice Example",
            email="alice@example.com",
            status="inactive",
        )
        with patch("app.routers.scim.UserService.patch_scim_user", return_value=fake_user) as patched:
            response = client.patch(
                "/scim/v2/Users/123",
                headers={"Authorization": "Bearer secret-token"},
                json={
                    "Operations": [
                        {"op": "Replace", "path": "role", "value": "reviewer"},
                        {"op": "Replace", "path": "active", "value": False},
                    ]
                },
            )
    finally:
        scim.settings = original_settings

    assert response.status_code == 200
    patched.assert_called_once()
    body = response.json()
    assert body["id"] == "123"
    assert body["active"] is False


def test_scim_delete_user_soft_deactivates(db):
    from app.auth import scim
    from app.config import Settings

    app = FastAPI()
    app.include_router(scim_router)
    app.dependency_overrides[get_db] = lambda: db

    original_settings = scim.settings
    try:
        scim.settings = Settings(scim_token="secret-token")
        client = TestClient(app)
        fake_user = SimpleNamespace(
            id=123,
            username="alice@example.com",
            display_name="Alice Example",
            email="alice@example.com",
            status="inactive",
        )
        with patch("app.routers.scim.UserService.deactivate_scim_user", return_value=fake_user) as patched:
            response = client.delete(
                "/scim/v2/Users/123",
                headers={"Authorization": "Bearer secret-token"},
            )
    finally:
        scim.settings = original_settings

    assert response.status_code == 200
    patched.assert_called_once_with(123)
    body = response.json()
    assert body["id"] == "123"
    assert body["active"] is False
