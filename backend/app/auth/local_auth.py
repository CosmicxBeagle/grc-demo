"""
Local auth bypass — no passwords, no Azure AD.
The client sends a username; the server returns that user's profile.
Replace this entire module with Azure AD / MSAL token validation when deploying.
"""
import base64
import json
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User


def encode_token(user_id: int, username: str, role: str) -> str:
    """Trivial base64 'token' — NOT for production."""
    payload = json.dumps({"user_id": user_id, "username": username, "role": role})
    return base64.b64encode(payload.encode()).decode()


def decode_token(token: str) -> dict:
    try:
        payload = json.loads(base64.b64decode(token.encode()).decode())
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(
    x_auth_token: str = Header(..., alias="X-Auth-Token"),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(x_auth_token)
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_role(*roles: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return dependency
