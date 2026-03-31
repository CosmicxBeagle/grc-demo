"""
Microsoft Graph OAuth2 endpoints.
/auth/login   → redirects to Microsoft login
/auth/callback → handles redirect back from Microsoft with auth code
/auth/status  → returns current authentication status
/auth/logout  → clears the token cache
"""

import uuid
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse, JSONResponse
from loguru import logger
from auth.msal_client import get_auth_url, exchange_code_for_token, is_authenticated, sign_out
from config import get_settings

router = APIRouter()
settings = get_settings()

# In-memory flow store (single user — no concurrency concern)
_auth_flows: dict = {}


@router.get("/login")
async def login(request: Request):
    """Redirect the user to Microsoft's login page."""
    redirect_uri = str(request.url_for("auth_callback"))
    state = str(uuid.uuid4())
    auth_url, flow = get_auth_url(redirect_uri=redirect_uri, state=state)
    _auth_flows[state] = flow
    return RedirectResponse(url=auth_url)


@router.get("/callback", name="auth_callback")
async def callback(request: Request, code: str = None, state: str = None, error: str = None):
    """Handle the OAuth2 callback from Microsoft."""
    if error:
        logger.error(f"OAuth error: {error}")
        return RedirectResponse(url="/settings?auth_error=1")

    flow = _auth_flows.pop(state, None)
    if not flow:
        return JSONResponse(status_code=400, content={"detail": "Invalid state. Please try again."})

    auth_response = dict(request.query_params)
    redirect_uri = str(request.url_for("auth_callback"))
    token = exchange_code_for_token(flow, auth_response)

    if token:
        logger.info("Microsoft 365 authentication successful.")
        return RedirectResponse(url="/settings?auth_success=1")
    else:
        return RedirectResponse(url="/settings?auth_error=1")


@router.get("/status")
async def auth_status():
    """Returns whether the app is currently authenticated with Microsoft 365."""
    return {"authenticated": is_authenticated()}


@router.post("/logout")
async def logout():
    """Sign out and clear the token cache."""
    sign_out()
    return {"message": "Signed out successfully."}
