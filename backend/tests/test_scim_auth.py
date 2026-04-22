import pytest
from fastapi import HTTPException

from app.auth.scim import require_scim_bearer
from app.config import Settings


def test_scim_enabled_requires_token():
    assert Settings(scim_token="").scim_enabled is False
    assert Settings(scim_token="secret-token").scim_enabled is True


def test_scim_bearer_rejects_when_not_configured(monkeypatch):
    from app.auth import scim

    monkeypatch.setattr(scim, "settings", Settings(scim_token=""))
    with pytest.raises(HTTPException) as exc:
        require_scim_bearer("Bearer secret-token")

    assert exc.value.status_code == 503
    assert exc.value.detail == "SCIM is not configured on this server."


def test_scim_bearer_accepts_valid_token(monkeypatch):
    from app.auth import scim

    monkeypatch.setattr(scim, "settings", Settings(scim_token="secret-token"))
    assert require_scim_bearer("Bearer secret-token") is None


def test_scim_bearer_rejects_invalid_header(monkeypatch):
    from app.auth import scim

    monkeypatch.setattr(scim, "settings", Settings(scim_token="secret-token"))
    with pytest.raises(HTTPException) as exc:
        require_scim_bearer("Basic nope")

    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid SCIM authorization header."


def test_scim_bearer_rejects_invalid_token(monkeypatch):
    from app.auth import scim

    monkeypatch.setattr(scim, "settings", Settings(scim_token="secret-token"))
    with pytest.raises(HTTPException) as exc:
        require_scim_bearer("Bearer wrong-token")

    assert exc.value.status_code == 403
    assert exc.value.detail == "Invalid SCIM bearer token."
