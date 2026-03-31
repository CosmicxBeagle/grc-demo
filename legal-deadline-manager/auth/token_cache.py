"""
MSAL Token Cache — Secure Storage
Uses Windows DPAPI (via pywin32) to encrypt the token cache file so it is
tied to the current Windows user account and machine. An attacker who steals
the file cannot decrypt it without the user's Windows credentials.

Falls back to AES-Fernet encryption (cross-platform) if pywin32 is not available.
"""

import os
import sys
from pathlib import Path
from typing import Optional

from loguru import logger
from msal import SerializableTokenCache

CACHE_FILE = Path("data/token_cache.bin")


def _dpapi_available() -> bool:
    return sys.platform == "win32"


def _encrypt(data: bytes) -> bytes:
    """Encrypt using DPAPI (Windows) or Fernet (cross-platform fallback)."""
    if _dpapi_available():
        try:
            import win32crypt
            encrypted, _ = win32crypt.CryptProtectData(
                data,
                "MSAL Token Cache",  # Description (shown in Windows Credential Manager)
                None, None, None,
                0  # Flags: 0 = encrypted data usable only on THIS machine by THIS user
            )
            return encrypted
        except ImportError:
            logger.warning("pywin32 not available; falling back to Fernet encryption")

    return _fernet_encrypt(data)


def _decrypt(data: bytes) -> bytes:
    """Decrypt using DPAPI (Windows) or Fernet (cross-platform fallback)."""
    if _dpapi_available():
        try:
            import win32crypt
            decrypted, _ = win32crypt.CryptUnprotectData(data, None, None, None, 0)
            return decrypted
        except ImportError:
            pass
        except Exception as e:
            logger.error(f"DPAPI decryption failed: {e}. Cache may be corrupted or from different user.")
            raise

    return _fernet_decrypt(data)


def _get_fernet_key() -> bytes:
    """Derive Fernet key from FIELD_ENCRYPTION_KEY env var."""
    from cryptography.fernet import Fernet
    key = os.environ.get("FIELD_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError(
            "FIELD_ENCRYPTION_KEY not set. Cannot encrypt token cache. "
            "Set this in your .env file."
        )
    # Fernet keys must be 32 url-safe base64 bytes
    return key.encode() if len(key) == 44 else Fernet.generate_key()


def _fernet_encrypt(data: bytes) -> bytes:
    from cryptography.fernet import Fernet
    f = Fernet(_get_fernet_key())
    return f.encrypt(data)


def _fernet_decrypt(data: bytes) -> bytes:
    from cryptography.fernet import Fernet
    f = Fernet(_get_fernet_key())
    return f.decrypt(data)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_token_cache() -> SerializableTokenCache:
    """Load the MSAL token cache from disk, decrypting it."""
    cache = SerializableTokenCache()
    if CACHE_FILE.exists():
        try:
            encrypted = CACHE_FILE.read_bytes()
            decrypted = _decrypt(encrypted)
            cache.deserialize(decrypted.decode("utf-8"))
            logger.debug("Token cache loaded and decrypted.")
        except Exception as e:
            logger.warning(f"Could not load token cache: {e}. Starting fresh.")
    return cache


def save_token_cache(cache: SerializableTokenCache) -> None:
    """Save the MSAL token cache to disk, encrypted."""
    if not cache.has_state_changed:
        return
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        serialized = cache.serialize().encode("utf-8")
        encrypted = _encrypt(serialized)
        CACHE_FILE.write_bytes(encrypted)
        # Restrict file permissions (owner read/write only)
        if sys.platform != "win32":
            os.chmod(CACHE_FILE, 0o600)
        logger.debug("Token cache saved and encrypted.")
    except Exception as e:
        logger.error(f"Failed to save token cache: {e}")
        raise


def clear_token_cache() -> None:
    """Delete the token cache (sign out)."""
    if CACHE_FILE.exists():
        CACHE_FILE.unlink()
        logger.info("Token cache cleared (user signed out).")
