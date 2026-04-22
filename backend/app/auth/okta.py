"""
Okta OIDC token validation.

Validates RS256 access tokens issued by Okta against the org's JWKS endpoint.
Normalizes claims to the same UserInfo shape used by the Entra ID provider.
"""
import json
from functools import lru_cache

import httpx
from jose import jwt, JWTError
from fastapi import HTTPException

from app.config import settings


@lru_cache(maxsize=1)
def _get_jwks() -> dict:
    """Fetch and cache Okta's public signing keys."""
    url = f"https://{settings.okta_domain}/oauth2/v1/keys"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def validate_okta_token(token: str) -> dict:
    """
    Validate an Okta access token and return its claims.
    Raises HTTP 401 on any validation failure.
    """
    try:
        jwks = _get_jwks()
        claims = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=settings.okta_audience,
            issuer=f"https://{settings.okta_domain}",
        )
        return claims
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Okta token: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Okta token validation failed: {exc}")


def exchange_code_for_token(code: str) -> str:
    """
    Exchange an Okta authorization code for an access token.
    Raises HTTP 401 on any validation failure.
    """
    try:
        resp = httpx.post(
            f"https://{settings.okta_domain}/oauth2/v1/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.okta_redirect_uri,
            },
            auth=(settings.okta_client_id, settings.okta_client_secret),
            headers={"Accept": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Okta code exchange failed: {exc}")

    access_token = payload.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Okta code exchange failed: missing access token")
    return access_token


def claims_to_user_info(claims: dict) -> dict:
    """
    Normalize Okta JWT claims to a standard shape.

    Okta claim names:
      sub           → unique user ID  (stable, use as external_id)
      email         → email address
      name          → display name
      given_name    → first name      (optional)
      family_name   → last name       (optional)
      department    → department      (optional, requires profile scope)
      title         → job title       (optional, requires profile scope)
    """
    email = claims.get("email") or claims.get("preferred_username", "")
    name  = claims.get("name") or email.split("@")[0]

    return {
        "external_id":       claims["sub"],
        "email":             email,
        "display_name":      name,
        "department":        claims.get("department"),
        "job_title":         claims.get("title"),
        "identity_provider": "okta",
    }
