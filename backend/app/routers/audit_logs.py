"""
Audit log query endpoint — admin and reviewer only.
Returns the append-only audit trail for in-app review.
For SIEM, the same events are emitted as structured JSON to stdout.
"""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import get_db
from app.auth.permissions import require_permission
from app.models.models import User, AuditLog

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("")
def list_audit_logs(
    resource_type: str = Query(None),
    action: str = Query(None),
    actor_email: str = Query(None),
    resource_id: int = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("audit:read")),
):
    q = db.query(AuditLog)

    if resource_type:
        q = q.filter(AuditLog.resource_type == resource_type)
    if action:
        q = q.filter(AuditLog.action == action)
    if actor_email:
        q = q.filter(AuditLog.actor_email.ilike(f"%{actor_email}%"))
    if resource_id is not None:
        q = q.filter(AuditLog.resource_id == resource_id)

    total = q.count()
    rows = q.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit).all()

    return {
        "total": total,
        "items": [_serialize(r) for r in rows],
    }


def _serialize(r: AuditLog) -> dict:
    return {
        "id":            r.id,
        "timestamp":     r.timestamp.isoformat() + "Z" if r.timestamp else None,
        "action":        r.action,
        "actor_email":   r.actor_email,
        "actor_role":    r.actor_role,
        "resource_type": r.resource_type,
        "resource_id":   r.resource_id,
        "resource_name": r.resource_name,
        "changes":       json.loads(r.changes) if r.changes else None,
        "ip_address":    r.ip_address,
        "request_id":    r.request_id,
    }
