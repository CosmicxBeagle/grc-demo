"""
Auth module — supports two modes:

  DEMO MODE  (AZURE_CLIENT_ID not set):
    Trivial base64 token. Username-only bypass. Local dev only.

  AZURE AD MODE (AZURE_CLIENT_ID set):
    Validates MSAL-issued access tokens (RS256 JWT) against Entra ID.
    Auto-provisions users on first login from Azure AD claims.
"""
import base64
import json

from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.models import User


# ── Token helpers ─────────────────────────────────────────────────────────────

def encode_token(user_id: int, username: str, role: str) -> str:
    """Demo-mode only: trivial base64 token. NOT for production."""
    payload = json.dumps({"user_id": user_id, "username": username, "role": role})
    return base64.b64encode(payload.encode()).decode()


def _is_jwt(token: str) -> bool:
    """Azure AD tokens are JWTs: three base64url parts separated by dots."""
    return token.count(".") == 2


def _decode_demo_token(token: str) -> dict:
    try:
        return json.loads(base64.b64decode(token.encode()).decode())
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Current-user dependency ───────────────────────────────────────────────────

def get_current_user(
    x_auth_token: str = Header(..., alias="X-Auth-Token"),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency — resolves the authenticated User from the request token.

    Routing logic:
      - Azure AD enabled + JWT-shaped token  → validate with Entra ID
      - Otherwise                             → demo base64 decode
    """
    if _is_jwt(x_auth_token) and (settings.azure_enabled or settings.okta_enabled):
        return _get_user_from_idp_token(x_auth_token, db)
    return _get_user_from_demo_token(x_auth_token, db)


def _get_user_from_demo_token(token: str, db: Session) -> User:
    payload = _decode_demo_token(token)
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
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
