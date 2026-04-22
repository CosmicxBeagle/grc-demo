from fastapi import Header, HTTPException

from app.config import settings


def require_scim_bearer(authorization: str | None = Header(None)) -> None:
    if not settings.scim_enabled:
        raise HTTPException(status_code=503, detail="SCIM is not configured on this server.")

    if not authorization:
        raise HTTPException(status_code=401, detail="Missing SCIM bearer token.")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid SCIM authorization header.")

    if token != settings.scim_token:
        raise HTTPException(status_code=403, detail="Invalid SCIM bearer token.")
