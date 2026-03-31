from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.schemas.schemas import LoginRequest, TokenResponse, AzureLoginRequest
from app.services.services import AuthService, AuditService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Demo-mode login — supply a username, get a base64 session token back.
    Disabled when any IdP (Entra or Okta) is configured.
    """
    if settings.azure_enabled or settings.okta_enabled:
        raise HTTPException(
            status_code=400,
            detail="Demo login is disabled — use /auth/azure-login or /auth/okta-login.",
        )
    try:
        result = AuthService(db).login(req)
        user = result["user"]
        AuditService(db).log(
            "AUTH_LOGIN", actor=user,
            resource_type="User", resource_id=user.id,
            resource_name=user.username,
            extra={"mode": "demo"},
            request=request,
        )
        return result
    except HTTPException as exc:
        AuditService(db).log(
            "AUTH_LOGIN_FAILED",
            resource_type="User", resource_name=req.username,
            extra={"mode": "demo", "reason": exc.detail},
            request=request,
        )
        raise


@router.post("/azure-login", response_model=TokenResponse)
def azure_login(req: AzureLoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Entra ID login — frontend sends the MSAL access token; backend validates
    it against Microsoft's JWKS, upserts the user, and returns a session token.
    """
    if not settings.azure_enabled:
        raise HTTPException(status_code=400, detail="Entra ID is not configured on this server.")
    result = AuthService(db).idp_login(req.access_token)
    user = result["user"]
    AuditService(db).log(
        "AUTH_SSO_LOGIN", actor=user,
        resource_type="User", resource_id=user.id,
        resource_name=getattr(user, "email", user.username),
        extra={"provider": "entra"},
        request=request,
    )
    return result


@router.post("/okta-login", response_model=TokenResponse)
def okta_login(req: AzureLoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Okta login — frontend sends the Okta access token; backend validates it
    against Okta's JWKS, upserts the user, and returns a session token.
    """
    if not settings.okta_enabled:
        raise HTTPException(status_code=400, detail="Okta is not configured on this server.")
    result = AuthService(db).idp_login(req.access_token)
    user = result["user"]
    AuditService(db).log(
        "AUTH_SSO_LOGIN", actor=user,
        resource_type="User", resource_id=user.id,
        resource_name=getattr(user, "email", user.username),
        extra={"provider": "okta"},
        request=request,
    )
    return result


@router.get("/config")
def auth_config():
    """
    Returns auth configuration so the frontend knows which login buttons to show.
    Safe to call without authentication.
    """
    return {
        "mode":             "idp" if (settings.azure_enabled or settings.okta_enabled) else "demo",
        "entra_enabled":    settings.azure_enabled,
        "okta_enabled":     settings.okta_enabled,
        "azure_client_id":  settings.azure_client_id  if settings.azure_enabled  else None,
        "azure_tenant_id":  settings.azure_tenant_id  if settings.azure_enabled  else None,
        "okta_domain":      settings.okta_domain       if settings.okta_enabled   else None,
        "okta_client_id":   settings.okta_client_id    if settings.okta_enabled   else None,
    }
