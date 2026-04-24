"""
Evidence storage abstraction.

Two backends, selected automatically:

  LOCAL  (dev / SQLite)  — AZURE_STORAGE_ACCOUNT not set
    Files written to  ./data/evidence/<assignment_id>/<uuid>.<ext>
    No extra dependencies required.

  AZURE  (Container Apps / production) — AZURE_STORAGE_ACCOUNT set
    Files stored in Azure Blob Storage using managed identity.
    No connection strings or keys in config — DefaultAzureCredential
    picks up the Container App's system-assigned managed identity.

Usage:
    from app import storage

    key  = storage.upload(contents, ".pdf", assignment_id=5)
    data = storage.download(key)
    storage.delete(key)

The returned `key` is what gets persisted in the Evidence.file_path column.
  - Local:  full filesystem path  e.g. "data/evidence/5/abc123.pdf"
  - Azure:  blob name             e.g. "evidence/5/abc123.pdf"
"""
import mimetypes
import uuid
from pathlib import Path

from app.config import settings


# ── Internal helpers ──────────────────────────────────────────────────────────

def _use_blob() -> bool:
    return bool(settings.azure_storage_account)


def _blob_client(blob_name: str):
    """Return an Azure BlobClient authenticated via managed identity."""
    from azure.identity import DefaultAzureCredential
    from azure.storage.blob import BlobServiceClient

    account_url = f"https://{settings.azure_storage_account}.blob.core.windows.net"
    svc = BlobServiceClient(account_url=account_url, credential=DefaultAzureCredential())
    return svc.get_blob_client(container=settings.azure_storage_container, blob=blob_name)


# ── Public API ────────────────────────────────────────────────────────────────

def upload(contents: bytes, ext: str, assignment_id: int) -> str:
    """
    Persist evidence bytes and return a storage key.

    Args:
        contents:      raw file bytes (already read + validated)
        ext:           lowercase file extension including dot, e.g. ".pdf"
        assignment_id: used to namespace files

    Returns:
        storage_key — store this in Evidence.file_path
    """
    stored_name = f"{uuid.uuid4().hex}{ext}"

    if _use_blob():
        blob_name = f"evidence/{assignment_id}/{stored_name}"
        _blob_client(blob_name).upload_blob(contents, overwrite=False)
        return blob_name
    else:
        upload_dir = Path(settings.evidence_upload_dir) / str(assignment_id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        dest = upload_dir / stored_name
        dest.write_bytes(contents)
        return str(dest)


def download(storage_key: str) -> tuple[bytes, str]:
    """
    Retrieve evidence bytes and a suitable Content-Type header value.

    Args:
        storage_key: value from Evidence.file_path

    Returns:
        (bytes, content_type)

    Raises:
        FileNotFoundError if the file / blob does not exist.
    """
    # Guess MIME type from extension — works for both local paths and blob names
    mime, _ = mimetypes.guess_type(storage_key)
    content_type = mime or "application/octet-stream"

    # Safety guardrail: never serve evidence files as text/html or executable
    # script types — this prevents XSS if a file somehow slips through upload
    # validation with a dangerous MIME type.
    _UNSAFE_CONTENT_TYPES = {
        "text/html", "application/xhtml+xml",
        "text/javascript", "application/javascript", "application/x-javascript",
        "application/x-httpd-php", "application/x-sh", "text/x-python",
    }
    if content_type in _UNSAFE_CONTENT_TYPES:
        content_type = "application/octet-stream"

    if _use_blob():
        client = _blob_client(storage_key)
        try:
            stream = client.download_blob()
            return stream.readall(), content_type
        except Exception as exc:
            raise FileNotFoundError(f"Blob not found: {storage_key}") from exc
    else:
        p = Path(storage_key)
        if not p.exists():
            raise FileNotFoundError(f"Evidence file not found: {storage_key}")
        return p.read_bytes(), content_type


def delete(storage_key: str) -> None:
    """
    Delete evidence from storage.  Silent no-op if the file is already gone.

    Args:
        storage_key: value from Evidence.file_path
    """
    if _use_blob():
        try:
            _blob_client(storage_key).delete_blob()
        except Exception:
            pass  # already deleted or never existed — safe to ignore
    else:
        p = Path(storage_key)
        if p.exists():
            p.unlink()
