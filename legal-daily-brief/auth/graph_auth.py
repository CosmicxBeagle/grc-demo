"""
Microsoft Graph authentication.
Uses device-code flow on first run — you'll see:
  "Go to https://microsoft.com/devicelogin and enter code XXXX-XXXX"
After that, the token is cached and silently refreshed for up to 90 days.
No browser redirect server needed.
"""

import msal
from loguru import logger
from auth.token_cache import load_cache, save_cache

SCOPES = ["Calendars.Read", "Mail.Send"]


def _build_app() -> tuple[msal.PublicClientApplication, msal.SerializableTokenCache]:
    from config import cfg
    cache = load_cache()
    app = msal.PublicClientApplication(
        client_id=cfg.azure_client_id,
        authority=f"https://login.microsoftonline.com/{cfg.azure_tenant_id}",
        token_cache=cache,
    )
    return app, cache


def get_token() -> str:
    """
    Returns a valid access token, refreshing silently if possible.
    On first run (or after 90 days), prompts the user with device code flow.
    """
    app, cache = _build_app()

    # Try silent first
    accounts = app.get_accounts()
    if accounts:
        result = app.acquire_token_silent(SCOPES, account=accounts[0])
        if result and "access_token" in result:
            save_cache(cache)
            return result["access_token"]

    # Device code flow — works from any terminal, no browser redirect needed
    flow = app.initiate_device_flow(scopes=SCOPES)
    if "user_code" not in flow:
        raise RuntimeError(f"Could not start device flow: {flow.get('error_description')}")

    print("\n" + "=" * 60)
    print("  ONE-TIME MICROSOFT LOGIN REQUIRED")
    print("=" * 60)
    print(f"  1. Open a browser and go to:  {flow['verification_uri']}")
    print(f"  2. Enter this code:           {flow['user_code']}")
    print("  3. Sign in with your Microsoft 365 account")
    print("  (This will not be needed again for ~90 days)")
    print("=" * 60 + "\n")

    result = app.acquire_token_by_device_flow(flow)

    if "access_token" in result:
        save_cache(cache)
        logger.info("Microsoft 365 login successful.")
        return result["access_token"]

    raise RuntimeError(f"Login failed: {result.get('error_description', 'unknown error')}")


def sign_out() -> None:
    from auth.token_cache import clear_cache
    clear_cache()
