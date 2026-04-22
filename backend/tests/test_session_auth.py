from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from datetime import datetime, timedelta, timezone

from app.auth.local_auth import encode_token, get_current_user
from app.auth.rate_limit import reset_rate_limits
from app.db.database import get_db
from app.middleware.session_refresh import session_refresh_middleware
from app.routers.auth import router as auth_router


def test_signed_session_token_rejects_tampering(db):
    reset_rate_limits()
    token = encode_token(1, "alice@example.com", "admin")
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")

    app = FastAPI()
    app.dependency_overrides[get_db] = lambda: db

    @app.get("/protected")
    def protected(current_user=Depends(get_current_user)):
        return {"user_id": current_user.id}

    client = TestClient(app)
    response = client.get("/protected", cookies={"session": tampered})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid token"


def test_expired_session_token_returns_session_expired(db):
    reset_rate_limits()
    expired_token = encode_token(
        1,
        "alice@example.com",
        "admin",
        issued_at=datetime.now(timezone.utc) - timedelta(hours=2),
    )

    app = FastAPI()
    app.dependency_overrides[get_db] = lambda: db

    @app.get("/protected")
    def protected(current_user=Depends(get_current_user)):
        return {"user_id": current_user.id}

    client = TestClient(app)
    response = client.get("/protected", cookies={"session": expired_token})

    assert response.status_code == 401
    assert response.json()["detail"] == "session_expired"


def test_active_cookie_session_gets_refreshed(db):
    from .conftest import make_user

    reset_rate_limits()
    user = make_user(db, role="admin", display_name="Alice", email="alice@example.com")
    original_token = encode_token(
        user.id,
        user.username,
        user.role,
        issued_at=datetime.now(timezone.utc) - timedelta(minutes=30),
    )

    app = FastAPI()
    app.dependency_overrides[get_db] = lambda: db
    app.middleware("http")(session_refresh_middleware)

    @app.get("/protected")
    def protected(current_user=Depends(get_current_user)):
        return {"user_id": current_user.id}

    client = TestClient(app)
    response = client.get("/protected", cookies={"session": original_token})

    assert response.status_code == 200
    assert "set-cookie" in response.headers
    refreshed_cookie = response.cookies.get("session")
    assert refreshed_cookie
    assert refreshed_cookie != original_token


def test_login_sets_session_cookie(db):
    from app.config import settings
    from .conftest import make_user

    reset_rate_limits()
    make_user(db, role="admin", display_name="Alice", email="alice@example.com")

    app = FastAPI()
    app.include_router(auth_router, prefix="/v1")
    app.dependency_overrides[get_db] = lambda: db

    original_demo_auth_enabled = settings.demo_auth_enabled
    original_session_cookie_name = settings.session_cookie_name
    original_session_cookie_samesite = settings.session_cookie_samesite
    original_app_env = settings.app_env
    try:
        settings.demo_auth_enabled = True
        settings.session_cookie_name = "session"
        settings.session_cookie_samesite = "lax"
        settings.app_env = "local"
        client = TestClient(app)
        response = client.post("/v1/auth/login", json={"username": "alice@example.com"})
    finally:
        settings.demo_auth_enabled = original_demo_auth_enabled
        settings.session_cookie_name = original_session_cookie_name
        settings.session_cookie_samesite = original_session_cookie_samesite
        settings.app_env = original_app_env

    assert response.status_code == 200
    assert response.cookies.get("session")
    assert "HttpOnly" in response.headers["set-cookie"]


def test_logout_clears_session_cookie(db):
    from app.config import settings

    reset_rate_limits()
    app = FastAPI()
    app.include_router(auth_router, prefix="/v1")

    original_session_cookie_name = settings.session_cookie_name
    original_session_cookie_samesite = settings.session_cookie_samesite
    original_app_env = settings.app_env
    try:
        settings.session_cookie_name = "session"
        settings.session_cookie_samesite = "lax"
        settings.app_env = "local"
        client = TestClient(app)
        response = client.post("/v1/auth/logout")
    finally:
        settings.session_cookie_name = original_session_cookie_name
        settings.session_cookie_samesite = original_session_cookie_samesite
        settings.app_env = original_app_env

    assert response.status_code == 200
    assert response.json() == {"detail": "Logged out"}
    assert "session=\"\"" in response.headers["set-cookie"]


def test_login_rate_limit_blocks_after_threshold(db):
    from app.config import settings
    from .conftest import make_user

    reset_rate_limits()
    make_user(db, role="admin", display_name="Alice", email="alice@example.com")

    app = FastAPI()
    app.include_router(auth_router, prefix="/v1")
    app.dependency_overrides[get_db] = lambda: db

    original_demo_auth_enabled = settings.demo_auth_enabled
    original_session_cookie_name = settings.session_cookie_name
    original_session_cookie_samesite = settings.session_cookie_samesite
    original_app_env = settings.app_env
    original_attempts = settings.auth_rate_limit_attempts
    original_window = settings.auth_rate_limit_window_seconds
    try:
        settings.demo_auth_enabled = True
        settings.session_cookie_name = "session"
        settings.session_cookie_samesite = "lax"
        settings.app_env = "local"
        settings.auth_rate_limit_attempts = 2
        settings.auth_rate_limit_window_seconds = 60
        client = TestClient(app)

        first = client.post("/v1/auth/login", json={"username": "alice@example.com"})
        second = client.post("/v1/auth/login", json={"username": "alice@example.com"})
        third = client.post("/v1/auth/login", json={"username": "alice@example.com"})
    finally:
        settings.demo_auth_enabled = original_demo_auth_enabled
        settings.session_cookie_name = original_session_cookie_name
        settings.session_cookie_samesite = original_session_cookie_samesite
        settings.app_env = original_app_env
        settings.auth_rate_limit_attempts = original_attempts
        settings.auth_rate_limit_window_seconds = original_window
        reset_rate_limits()

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.json()["detail"] == "Too many authentication attempts. Please try again later."
