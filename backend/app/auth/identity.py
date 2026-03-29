"""
Identity provider abstraction layer.

Normalizes Entra ID and Okta tokens into a shared UserInfo dict so the rest
of the auth system never needs to know which IdP authenticated the user.

UserInfo keys:
  external_id       str   — stable unique ID from IdP (oid for Entra, sub for Okta)
  email             str   — user's email address
  display_name      str   — full display name
  department        str?  — department from IdP profile (may be None)
  job_title         str?  — job title from IdP profile (may be None)
  identity_provider str   — "entra" | "okta"
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.config import settings
from app.models.models import User


def validate_token(token: str) -> dict:
    """
    Detect token issuer from the JWT 'iss' claim and route to the correct
    provider for validation.  Returns a normalized UserInfo dict.
    """
    import base64, json

    # Peek at the payload without verifying to read the issuer
    try:
        parts   = token.split(".")
        padded  = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        issuer  = payload.get("iss", "")
    except Exception:
        raise HTTPException(status_code=401, detail="Malformed JWT token")

    if settings.okta_enabled and settings.okta_domain in issuer:
        from app.auth.okta import validate_okta_token, claims_to_user_info as okta_claims
        claims = validate_okta_token(token)
        return okta_claims(claims)

    if settings.azure_enabled and "microsoftonline.com" in issuer:
        from app.auth.azure_ad import validate_azure_token, claims_to_user_info as entra_claims
        claims = validate_azure_token(token)
        info   = entra_claims(claims)
        return {
            "external_id":       info["oid"],
            "email":             info["email"],
            "display_name":      info["display_name"],
            "department":        info.get("department"),
            "job_title":         info.get("job_title"),
            "identity_provider": "entra",
        }

    raise HTTPException(
        status_code=401,
        detail="Token issuer not recognized. Configure AZURE_TENANT_ID or OKTA_DOMAIN.",
    )


def upsert_user(db: Session, info: dict) -> User:
    """
    Look up a user by external_id or email.
    - Found: sync display_name, department, job_title, last_login_at.
             NOTE: role is NOT synced from IdP — it is managed in the app.
    - Not found: create with default role 'viewer'.
    """
    user = (
        db.query(User).filter(User.external_id == info["external_id"]).first()
        or db.query(User).filter(User.email == info["email"]).first()
    )

    now = datetime.utcnow()

    if not user:
        user = User(
            username          = info["external_id"],   # stable IdP ID as username
            external_id       = info["external_id"],
            display_name      = info["display_name"] or info["email"],
            email             = info["email"],
            role              = "viewer",              # default — admin promotes
            status            = "active",
            identity_provider = info["identity_provider"],
            department        = info.get("department"),
            job_title         = info.get("job_title"),
            last_login_at     = now,
        )
        db.add(user)
    else:
        # Keep profile in sync; never overwrite role
        user.external_id       = info["external_id"]
        user.display_name      = info["display_name"] or user.display_name
        user.identity_provider = info["identity_provider"]
        user.last_login_at     = now
        if info.get("department"):
            user.department = info["department"]
        if info.get("job_title"):
            user.job_title = info["job_title"]
        if user.status == "inactive":
            raise HTTPException(status_code=403, detail="Your account has been deactivated.")

    db.commit()
    db.refresh(user)
    return user
