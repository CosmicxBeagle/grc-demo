"""
Secure MSAL token cache using the OS keychain.

  macOS   → stored in macOS Keychain (Keychain Access app)
  Windows → stored in Windows Credential Manager

The token never touches a plain-text file on disk.
Uses the `keyring` library which wraps both natively.
"""

import sys
from msal import SerializableTokenCache
from loguru import logger

_SERVICE  = "LegalDailyBrief"
_USERNAME = "msal_token_cache"


def load_cache() -> SerializableTokenCache:
    cache = SerializableTokenCache()
    try:
        import keyring
        data = keyring.get_password(_SERVICE, _USERNAME)
        if data:
            cache.deserialize(data)
            logger.debug("Token cache loaded from OS keychain.")
    except Exception as e:
        logger.warning(f"Could not load token cache: {e} — you may need to log in again.")
    return cache


def save_cache(cache: SerializableTokenCache) -> None:
    if not cache.has_state_changed:
        return
    try:
        import keyring
        keyring.set_password(_SERVICE, _USERNAME, cache.serialize())
        logger.debug("Token cache saved to OS keychain.")
    except Exception as e:
        logger.error(f"Could not save token cache: {e}")


def clear_cache() -> None:
    try:
        import keyring
        keyring.delete_password(_SERVICE, _USERNAME)
        logger.info("Signed out — token removed from OS keychain.")
    except Exception:
        pass   # Already gone
