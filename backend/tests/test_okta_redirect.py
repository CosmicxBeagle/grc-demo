from fastapi import FastAPI
from fastapi.testclient import TestClient
import sys
from types import ModuleType
from unittest.mock import patch

from app.db.database import get_db
from app.routers.auth import router as auth_router


def test_okta_login_redirect_builds_authorize_url():
    from app.config import settings

    app = FastAPI()
    app.include_router(auth_router, prefix="/v1")

    original_domain = settings.okta_domain
    original_client_id = settings.okta_client_id
    original_client_secret = settings.okta_client_secret
    original_redirect_uri = settings.okta_redirect_uri
    original_scopes = settings.okta_scopes
    original_app_env = settings.app_env
    try:
        settings.okta_domain = "example.okta.com"
        settings.okta_client_id = "client123"
        settings.okta_client_secret = "secret123"
        settings.okta_redirect_uri = "https://app.example.com/auth/callback"
        settings.okta_scopes = "openid profile email"
        settings.app_env = "local"

        client = TestClient(app)
        response = client.get("/v1/auth/okta/login", follow_redirects=False)
    finally:
        settings.okta_domain = original_domain
        settings.okta_client_id = original_client_id
        settings.okta_client_secret = original_client_secret
        settings.okta_redirect_uri = original_redirect_uri
        settings.okta_scopes = original_scopes
        settings.app_env = original_app_env

    assert response.status_code == 307
    location = response.headers["location"]
    assert location.startswith("https://example.okta.com/oauth2/v1/authorize?")
    assert "client_id=client123" in location
    assert "response_type=code" in location
    assert "redirect_uri=https%3A%2F%2Fapp.example.com%2Fauth%2Fcallback" in location
    assert "scope=openid+profile+email" in location
    assert "state=" in location
    assert response.cookies.get("okta_oauth_state")


def test_okta_callback_sets_session_cookie_and_redirects(db):
    from app.config import settings
    from .conftest import make_user

    app = FastAPI()
    app.include_router(auth_router, prefix="/v1")
    app.dependency_overrides[get_db] = lambda: db

    user = make_user(db, role="viewer", display_name="Okta User", email="okta@example.com")

    original_domain = settings.okta_domain
    original_client_id = settings.okta_client_id
    original_client_secret = settings.okta_client_secret
    original_redirect_uri = settings.okta_redirect_uri
    original_scopes = settings.okta_scopes
    original_app_base_url = settings.app_base_url
    original_app_env = settings.app_env
    try:
        settings.okta_domain = "example.okta.com"
        settings.okta_client_id = "client123"
        settings.okta_client_secret = "secret123"
        settings.okta_redirect_uri = "https://app.example.com/auth/okta/callback"
        settings.okta_scopes = "openid profile email"
        settings.app_base_url = "https://app.example.com"
        settings.app_env = "local"

        client = TestClient(app)
        fake_okta_module = ModuleType("app.auth.okta")
        fake_okta_module.exchange_code_for_token = lambda code: "okta-access-token"
        with patch.dict(sys.modules, {"app.auth.okta": fake_okta_module}), \
             patch("app.routers.auth.AuthService.idp_login", return_value={"access_token": "app-session-token", "user": user}):
            response = client.get(
                "/v1/auth/okta/callback?code=abc123&state=state123",
                cookies={"okta_oauth_state": "state123"},
                follow_redirects=False,
            )
    finally:
        settings.okta_domain = original_domain
        settings.okta_client_id = original_client_id
        settings.okta_client_secret = original_client_secret
        settings.okta_redirect_uri = original_redirect_uri
        settings.okta_scopes = original_scopes
        settings.app_base_url = original_app_base_url
        settings.app_env = original_app_env

    assert response.status_code == 307
    assert response.headers["location"] == "https://app.example.com/dashboard"
    assert response.cookies.get("session") == "app-session-token"
    set_cookie_header = response.headers.get("set-cookie", "")
    assert "okta_oauth_state=\"\"" in set_cookie_header
