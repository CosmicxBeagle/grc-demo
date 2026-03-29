"""
Azure AD / Entra ID token validation.

Validates an MSAL-issued access token (RS256 JWT) against Microsoft's
published JWKS endpoint. Caches keys for 1 hour to avoid hammering the endpoint.
"""
import time
import httpx
from jose import jwt, JWTError, ExpiredSignatureError
from fastapi import HTTPException, status
from app.config import settings

_jwks_cache: dict = {}
_jwks_cache_time: float = 0.0
_JWKS_TTL: int = 3600  # seconds


def _get_jwks() -> dict:
    """Fetch (or return cached) Azure AD JWKS public keys."""
    global _jwks_cache, _jwks_cache_time
    if _jwks_cache and (time.time() - _jwks_cache_time) < _JWKS_TTL:
        return _jwks_cache
    url = (
        f"https://login.microsoftonline.com/"
        f"{settings.azure_tenant_id}/discovery/v2.0/keys"
    )
    try:
        resp = httpx.get(url, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_cache_time = time.time()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not reach Azure AD JWKS endpoint: {exc}",
        )
    return _jwks_cache


def validate_azure_token(token: str) -> dict:
    """
    Validate an Azure AD access token.
    Returns the decoded JWT claims dict on success.
    Raises HTTPException 401 on failure.
    """
    jwks = _get_jwks()
    audience = settings.azure_audience or settings.azure_client_id
    issuer = f"https://login.microsoftonline.com/{settings.azure_tenant_id}/v2.0"

    try:
        claims = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=audience,
            issuer=issuer,
        )
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Azure AD token has expired — please sign in again")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Azure AD token: {exc}")

    return claims


def extract_grc_role(claims: dict) -> str:
    """
    Map Azure AD app roles to GRC roles.

    Define these App Roles in your Azure AD app registration:
      GRC.Admin    → admin
      GRC.Tester   → tester
      GRC.Reviewer → reviewer

    Users with no assigned role default to 'viewer'.
    """
    role_map = {
        "GRC.Admin": "admin",
        "GRC.Tester": "tester",
        "GRC.Reviewer": "reviewer",
    }
    roles: list = claims.get("roles", [])
    for azure_role, grc_role in role_map.items():
        if azure_role in roles:
            return grc_role
    return "viewer"


def claims_to_user_info(claims: dict) -> dict:
    """Extract standardised user info from Azure AD token claims."""
    return {
        "oid": claims.get("oid", ""),                      # Azure object ID — stable unique ID
        "email": (
            claims.get("preferred_username")
            or claims.get("email")
            or claims.get("upn", "")
        ),
        "display_name": claims.get("name", ""),
        "role": extract_grc_role(claims),
    }
