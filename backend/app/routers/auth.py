from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from urllib.parse import urlencode
import secrets

from app.config import settings
from app.auth.rate_limit import enforce_auth_rate_limit
from app.db.database import get_db
from app.schemas.schemas import LoginRequest, TokenResponse, AzureLoginRequest
from app.services.services import AuthService
from app.services import audit_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, session_token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
    )


def _set_oidc_state_cookie(response: Response, state: str) -> None:
    response.set_cookie(
        key="okta_oauth_state",
        value=state,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )


def _clear_oidc_state_cookie(response: Response) -> None:
    response.delete_cookie(
        key="okta_oauth_state",
        path="/",
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
    )


@router.get("/okta/login")
def okta_login_redirect():
    if not settings.okta_oidc_enabled:
        raise HTTPException(status_code=400, detail="Okta OIDC is not configured on this server.")

    state = secrets.token_urlsafe(24)
    query = urlencode(
        {
            "client_id": settings.okta_client_id,
            "response_type": "code",
            "scope": settings.okta_scopes,
            "redirect_uri": settings.okta_redirect_uri,
            "state": state,
        }
    )
    response = RedirectResponse(
        url=f"https://{settings.okta_domain}/oauth2/v1/authorize?{query}",
        status_code=307,
    )
    _set_oidc_state_cookie(response, state)
    return response


@router.get("/okta/callback")
def okta_callback(code: str, state: str, request: Request, db: Session = Depends(get_db)):
    if not settings.okta_oidc_enabled:
        raise HTTPException(status_code=400, detail="Okta OIDC is not configured on this server.")

    expected_state = request.cookies.get("okta_oauth_state")
    if not expected_state or state != expected_state:
        raise HTTPException(status_code=400, detail="Invalid Okta OAuth state.")

    from app.auth.okta import exchange_code_for_token

    access_token = exchange_code_for_token(code)
    result = AuthService(db).idp_login(access_token)
    user = result["user"]

    response = RedirectResponse(url=f"{settings.app_base_url}/dashboard", status_code=307)
    _set_session_cookie(response, result["access_token"])
    _clear_oidc_state_cookie(response)
    audit_service.emit(
        db,
        "AUTH_SSO_LOGIN",
        actor=user,
        resource_type="User",
        resource_id=user.id,
        resource_name=getattr(user, "email", user.username),
        extra={"provider": "okta_oidc"},
        request=request,
    )
    return response


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, response: Response, _: None = Depends(enforce_auth_rate_limit), db: Session = Depends(get_db)):
    """
    Demo-mode login — supply a username, get a base64 session token back.
    Disabled when any IdP (Entra or Okta) is configured.
    """
    if not settings.demo_login_enabled:
        raise HTTPException(
            status_code=403,
            detail="Demo authentication is disabled on this server.",
        )
    try:
        result = AuthService(db).login(req)
        _set_session_cookie(response, result["access_token"])
        user = result["user"]
        audit_service.emit(db,
            "AUTH_LOGIN", actor=user,
            resource_type="User", resource_id=user.id,
            resource_name=user.username,
            extra={"mode": "demo"},
            request=request,
        )
        return result
    except HTTPException as exc:
        audit_service.emit(db,
            "AUTH_LOGIN_FAILED",
            resource_type="User", resource_name=req.username,
            extra={"mode": "demo", "reason": exc.detail},
            request=request,
        )
        raise


@router.post("/azure-login", response_model=TokenResponse)
def azure_login(req: AzureLoginRequest, request: Request, response: Response, _: None = Depends(enforce_auth_rate_limit), db: Session = Depends(get_db)):
    """
    Entra ID login — frontend sends the MSAL access token; backend validates
    it against Microsoft's JWKS, upserts the user, and returns a session token.
    """
    if not settings.azure_enabled:
        raise HTTPException(status_code=400, detail="Entra ID is not configured on this server.")
    result = AuthService(db).idp_login(req.access_token)
    _set_session_cookie(response, result["access_token"])
    user = result["user"]
    audit_service.emit(db,
        "AUTH_SSO_LOGIN", actor=user,
        resource_type="User", resource_id=user.id,
        resource_name=getattr(user, "email", user.username),
        extra={"provider": "entra"},
        request=request,
    )
    return result


@router.post("/okta-login", response_model=TokenResponse)
def okta_login(req: AzureLoginRequest, request: Request, response: Response, _: None = Depends(enforce_auth_rate_limit), db: Session = Depends(get_db)):
    """
    Okta login — frontend sends the Okta access token; backend validates it
    against Okta's JWKS, upserts the user, and returns a session token.
    """
    if not settings.okta_enabled:
        raise HTTPException(status_code=400, detail="Okta is not configured on this server.")
    result = AuthService(db).idp_login(req.access_token)
    _set_session_cookie(response, result["access_token"])
    user = result["user"]
    audit_service.emit(db,
        "AUTH_SSO_LOGIN", actor=user,
        resource_type="User", resource_id=user.id,
        resource_name=getattr(user, "email", user.username),
        extra={"provider": "okta"},
        request=request,
    )
    return result


@router.post("/logout")
def logout(response: Response):
    _clear_session_cookie(response)
    return {"detail": "Logged out"}


@router.get("/config")
def auth_config():
    """
    Returns auth configuration so the frontend knows which login buttons to show.
    Safe to call without authentication.
    """
    return {
        "mode":             "idp" if (settings.azure_enabled or settings.okta_enabled) else ("demo" if settings.demo_login_enabled else "disabled"),
        "entra_enabled":    settings.azure_enabled,
        "okta_enabled":     settings.okta_enabled,
        "demo_enabled":     settings.demo_login_enabled,
        "azure_client_id":  settings.azure_client_id  if settings.azure_enabled  else None,
        "azure_tenant_id":  settings.azure_tenant_id  if settings.azure_enabled  else None,
        "okta_domain":      settings.okta_domain       if settings.okta_enabled   else None,
        "okta_client_id":   settings.okta_client_id    if settings.okta_enabled   else None,
    }
