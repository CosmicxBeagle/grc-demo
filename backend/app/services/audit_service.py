"""
audit_service.emit() — the single canonical way to write an audit event.

Rules:
  - NEVER raises. Wraps everything in try/except and logs the failure.
  - Uses an isolated DB session so audit persistence never commits or
    rolls back the caller's in-flight business transaction.
  - Also emits a structured JSON line to the 'audit' Python logger for SIEM,
    regardless of DB outcome, so every attempt reaches the SIEM pipeline.
"""
import json
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.models import AuditLog

_log = logging.getLogger("audit")
_err_log = logging.getLogger(__name__)


def _diff(before: dict | None, after: dict | None) -> dict:
    if not before or not after:
        return {}
    all_keys = set(before) | set(after)
    return {
        k: {"from": before.get(k), "to": after.get(k)}
        for k in all_keys
        if before.get(k) != after.get(k)
    }


def emit(
    db: Session,
    action: str,
    *,
    # Convenience: pass the User ORM object directly
    actor: Any = None,
    # Or pass individual fields
    actor_id: Optional[int] = None,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    resource_name: Optional[str] = None,
    before: Optional[dict] = None,
    after: Optional[dict] = None,
    # FastAPI Request object — extracts IP and User-Agent automatically
    request: Any = None,
    extra: Optional[dict] = None,
) -> None:
    """
    Record one audit event.

    Accepts either a User ORM object via ``actor=`` or individual
    ``actor_id`` / ``actor_email`` / ``actor_role`` kwargs — whichever
    is more convenient at the call site.

    Never propagates exceptions to the caller — audit logging must never
    break a business operation.
    """
    # ── Resolve actor fields ──────────────────────────────────────────────────
    if actor is not None:
        actor_id    = actor_id    or getattr(actor, "id",    None)
        actor_email = actor_email or getattr(actor, "email", None)
        actor_role  = actor_role  or getattr(actor, "role",  None)

    # ── Resolve request context ───────────────────────────────────────────────
    ip = None
    ua = None
    if request is not None:
        try:
            ip = request.client.host if request.client else None
        except Exception:
            pass
        try:
            ua = (request.headers.get("user-agent") or "")[:500]
        except Exception:
            pass

    changes    = _diff(before, after)
    request_id = str(uuid.uuid4())

    # ── 1. Write to DB via an isolated session ────────────────────────────────
    # Using a separate session means the audit row is committed independently
    # of the caller's transaction — it survives a business-layer rollback.
    try:
        from app.db.database import SessionLocal
        audit_db = SessionLocal()
        try:
            entry = AuditLog(
                timestamp=datetime.utcnow(),
                actor_id=actor_id,
                actor_email=actor_email,
                actor_role=actor_role,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                resource_name=resource_name,
                before_state=json.dumps(before,   default=str) if before   else None,
                after_state= json.dumps(after,    default=str) if after    else None,
                changes=     json.dumps(changes,  default=str) if changes  else None,
                ip_address=ip,
                request_id=request_id,
            )
            audit_db.add(entry)
            audit_db.commit()
        finally:
            audit_db.close()
    except Exception as exc:
        _err_log.error("audit_service.emit failed (DB): %s", exc, exc_info=True)

    # ── 2. SIEM structured log ────────────────────────────────────────────────
    # Always attempted, even when the DB write fails.
    try:
        _log.info(json.dumps({
            "event":      "audit",
            "ts":         datetime.utcnow().isoformat() + "Z",
            "action":     action,
            "actor": {
                "id":    actor_id,
                "email": actor_email,
                "role":  actor_role,
            },
            "resource": {
                "type": resource_type,
                "id":   resource_id,
                "name": resource_name,
            },
            "changes":    changes,
            "ip":         ip,
            "request_id": request_id,
            **(extra or {}),
        }, default=str))
    except Exception as exc:
        _err_log.error("audit_service.emit failed (SIEM log): %s", exc, exc_info=True)
