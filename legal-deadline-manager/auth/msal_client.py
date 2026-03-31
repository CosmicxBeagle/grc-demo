"""
MSAL Client — Microsoft Authentication for Microsoft Graph API
Uses Authorization Code + PKCE flow via localhost redirect.

IMPORTANT: Tasks API requires DELEGATED permissions (user sign-in).
           Calendar API supports APPLICATION permissions too, but we use
           delegated here for simplicity (single user, single tenant).

OAuth flow:
  1. User clicks "Connect to Microsoft 365" in the web UI
  2. Browser redirects to login.microsoftonline.com
  3. User logs in + approves permissions (once)
  4. Microsoft redirects to http://localhost:8000/auth/callback with auth code
  5. FastAPI /auth/callback endpoint exchanges code for tokens
  6. Tokens stored in DPAPI-encrypted cache
  7. All subsequent calls use silent token acquisition (auto-refresh)
"""

from typing import Optional, List
import msal
from loguru import logger

from config import get_settings
from auth.token_cache import load_token_cache, save_token_cache

settings = get_settings()


def get_msal_app() -> msal.PublicClientApplication:
    """
    Build the MSAL PublicClientApplication with persistent encrypted token cache.
    PublicClientApplication = no client secret needed (PKCE flow).
    """
    cache = load_token_cache()

    app = msal.PublicClientApplication(
        client_id=settings.azure_client_id,
        authority=f"https://login.microsoftonline.com/{settings.azure_tenant_id}",
        token_cache=cache,
    )
    return app, cache


def get_access_token(
    scopes: Optional[List[str]] = None,
) -> Optional[str]:
    """
    Acquire a valid access token silently (from cache / refresh token).
    Returns None if the user needs to re-authenticate interactively.

    Call this before every Graph API request. If it returns None,
    redirect the user to the /auth/login endpoint.
    """
    scopes = scopes or settings.graph_scopes_list
    app, cache = get_msal_app()

    # Try silent acquisition first (uses cached token or refresh token)
    accounts = app.get_accounts()
    if accounts:
        result = app.acquire_token_silent(scopes, account=accounts[0])
        if result and "access_token" in result:
            save_token_cache(cache)
            logger.debug("Token acquired silently from cache.")
            return result["access_token"]
        elif result and "error" in result:
            logger.warning(f"Silent token acquisition failed: {result.get('error_description')}")

    logger.info("No valid cached token — user must authenticate interactively.")
    return None


def get_auth_url(redirect_uri: str, state: str) -> str:
    """
    Generate the Microsoft authorization URL for the login redirect.
    Uses PKCE — no client secret required.
    """
    app, _ = get_msal_app()
    # Store code_verifier in flow for later use in callback
    flow = app.initiate_auth_code_flow(
        scopes=settings.graph_scopes_list,
        redirect_uri=redirect_uri,
        state=state,
    )
    return flow["auth_uri"], flow


def exchange_code_for_token(flow: dict, auth_response: dict) -> Optional[str]:
    """
    Exchange the authorization code (from the callback) for an access token.
    Called from the /auth/callback FastAPI endpoint.

    Args:
        flow:          The flow dict returned by initiate_auth_code_flow
        auth_response: The query params from the redirect callback (code, state)

    Returns:
        Access token string, or None on failure.
    """
    app, cache = get_msal_app()
    result = app.acquire_token_by_auth_code_flow(flow, auth_response)

    if "access_token" in result:
        save_token_cache(cache)
        logger.info("Token acquired via authorization code flow. User authenticated.")
        return result["access_token"]

    logger.error(f"Token exchange failed: {result.get('error')} — {result.get('error_description')}")
    return None


def is_authenticated() -> bool:
    """Check if the app has a valid token for the current user."""
    return get_access_token() is not None


def sign_out() -> None:
    """Remove cached tokens (sign out of Microsoft Graph)."""
    from auth.token_cache import clear_token_cache
    clear_token_cache()
    logger.info("User signed out of Microsoft Graph.")
