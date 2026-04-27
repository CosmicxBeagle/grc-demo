"""
Auth module — supports two modes:

  DEMO MODE  (AZURE_CLIENT_ID not set):
    Trivial base64 token. Username-only bypass. Local dev only.

  AZURE AD MODE (AZURE_CLIENT_ID set):
    Validates MSAL-issued access tokens (RS256 JWT) against Entra ID.
    Auto-provisions users on first login from Azure AD claims.
"""
import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Header, HTTPException, Depends, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.models import User


# ── Token helpers ─────────────────────────────────────────────────────────────

def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode())


def _sign(payload: str) -> str:
    digest = hmac.new(settings.session_secret.encode(), payload.encode(), hashlib.sha256).digest()
    return _b64url_encode(digest)


def encode_token(user_id: int, username: str, role: str, *, issued_at: Optional[datetime] = None) -> str:
    """Signed application session token used by both cookie and header auth."""
    issued_at = issued_at or datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=settings.session_timeout_minutes)
    payload = _b64url_encode(
        json.dumps(
            {
                "user_id": user_id,
                "username": username,
                "role": role,
                "kind": "session",
                "issued_at": int(issued_at.timestamp()),
                "expires_at": int(expires_at.timestamp()),
            },
            separators=(",", ":"),
        ).encode()
    )
    return f"{payload}.{_sign(payload)}"


def queue_session_refresh(request: Request, payload: dict) -> None:
    request.state.refresh_session_token = encode_token(
        payload["user_id"],
        payload["username"],
        payload["role"],
    )


def _is_jwt(token: str) -> bool:
    """Azure AD tokens are JWTs: three base64url parts separated by dots."""
    return token.count(".") == 2


def _decode_demo_token(token: str) -> dict:
    try:
        payload_b64, signature = token.split(".", 1)
        expected_signature = _sign(payload_b64)
        if not hmac.compare_digest(signature, expected_signature):
            raise ValueError("signature mismatch")
        payload = json.loads(_b64url_decode(payload_b64).decode())
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("kind") != "session":
        raise HTTPException(status_code=401, detail="Invalid token")
    expires_at = payload.get("expires_at")
    if not isinstance(expires_at, int):
        raise HTTPException(status_code=401, detail="Invalid token")
    if expires_at <= int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status_code=401, detail="session_expired")
    return payload


# ── Current-user dependency ───────────────────────────────────────────────────

def get_current_user(
    request: Request,
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency — resolves the authenticated User from the request token.

    Routing logic:
      - Azure AD enabled + JWT-shaped token  → validate with Entra ID
      - Otherwise                             → demo base64 decode
    """
    session_token = request.cookies.get(settings.session_cookie_name)
    token = session_token or x_auth_token
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if _is_jwt(token) and (settings.azure_enabled or settings.okta_enabled):
        return _get_user_from_idp_token(token, db)
    user = _get_user_from_demo_token(token, db)
    if session_token:
        queue_session_refresh(request, _decode_demo_token(token))
    return user


def _get_user_from_demo_token(token: str, db: Session) -> User:
    payload = _decode_demo_token(token)
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # Check both fields: status covers UI deactivations; deactivated_at covers
    # SCIM-provisioned deactivations that set the timestamp.
    if user.status == "inactive" or user.deactivated_at is not None:
        raise HTTPException(status_code=401, detail="Account deactivated")
    return user


def _get_user_from_idp_token(token: str, db: Session) -> User:
    """Route to Entra ID or Okta validator based on token issuer, then upsert user."""
    from app.auth.identity import validate_token, upsert_user
    info = validate_token(token)
    return upsert_user(db, info)


# ── Role guard ────────────────────────────────────────────────────────────────

def require_role(*roles: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return dependency
