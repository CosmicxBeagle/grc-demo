"""
Control Exceptions & Risk Acceptance — CRUD endpoints.
"""
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import User
from app.repositories.repositories import ControlExceptionRepository
from app.auth.permissions import require_permission
from app.services.services import AuditService
from app.schemas.schemas import (
    ControlExceptionCreate, ControlExceptionUpdate, ControlExceptionOut,
    ApproverNotesRequest,
    EXCEPTION_STATUSES,
)

router = APIRouter(prefix="/exceptions", tags=["exceptions"])


def _get_or_404(repo: ControlExceptionRepository, exception_id: int):
    exc = repo.get_by_id(exception_id)
    if not exc:
        raise HTTPException(status_code=404, detail="Exception not found")
    return exc


def _snap(e) -> dict:
    return {"status": e.status, "control_id": e.control_id,
            "reason": e.reason, "risk_level": e.risk_level,
            "approved_by": e.approved_by}


@router.get("", response_model=list[ControlExceptionOut])
def list_exceptions(
    status: str = None,
    control_id: int = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("exceptions:read")),
):
    repo = ControlExceptionRepository(db)
    return repo.get_all(status=status, control_id=control_id)


@router.post("", response_model=ControlExceptionOut, status_code=201)
def create_exception(
    payload: ControlExceptionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("exceptions:write")),
):
    repo = ControlExceptionRepository(db)
    data = payload.model_dump()
    data.setdefault("status", "pending_approval")
    data["requested_by"] = current_user.id
    result = repo.create(data)
    AuditService(db).log(
        "EXCEPTION_CREATED", actor=current_user,
        resource_type="Exception", resource_id=result.id,
        resource_name=result.reason[:80] if result.reason else str(result.id),
        after=_snap(result), request=request,
    )
    return result


@router.get("/{exception_id}", response_model=ControlExceptionOut)
def get_exception(
    exception_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("exceptions:read")),
):
    repo = ControlExceptionRepository(db)
    return _get_or_404(repo, exception_id)


@router.patch("/{exception_id}", response_model=ControlExceptionOut)
def update_exception(
    exception_id: int,
    payload: ControlExceptionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("exceptions:write")),
):
    repo = ControlExceptionRepository(db)
    exc = _get_or_404(repo, exception_id)
    before = _snap(exc)
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in EXCEPTION_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {EXCEPTION_STATUSES}")
    result = repo.update(exc, data)
    AuditService(db).log(
        "EXCEPTION_UPDATED", actor=current_user,
        resource_type="Exception", resource_id=exception_id,
        before=before, after=_snap(result), request=request,
    )
    return result


@router.post("/{exception_id}/approve", response_model=ControlExceptionOut)
def approve_exception(
    exception_id: int,
    request: Request,
    body: "ApproverNotesRequest | None" = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("exceptions:approve")),
):
    repo = ControlExceptionRepository(db)
    exc = _get_or_404(repo, exception_id)
    before = _snap(exc)
    result = repo.update(exc, {
        "status": "approved",
        "approved_by": current_user.id,
        "approver_notes": body.notes if body else None,
    })
    AuditService(db).log(
        "EXCEPTION_APPROVED", actor=current_user,
        resource_type="Exception", resource_id=exception_id,
        resource_name=result.reason[:80] if result.reason else str(exception_id),
        before=before, after=_snap(result), request=request,
    )
    return result


@router.post("/{exception_id}/reject", response_model=ControlExceptionOut)
def reject_exception(
    exception_id: int,
    request: Request,
    body: "ApproverNotesRequest | None" = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("exceptions:approve")),
):
    repo = ControlExceptionRepository(db)
    exc = _get_or_404(repo, exception_id)
    before = _snap(exc)
    result = repo.update(exc, {
        "status": "rejected",
        "approved_by": current_user.id,
        "approver_notes": body.notes if body else None,
    })
    AuditService(db).log(
        "EXCEPTION_REJECTED", actor=current_user,
        resource_type="Exception", resource_id=exception_id,
        resource_name=result.reason[:80] if result.reason else str(exception_id),
        before=before, after=_snap(result), request=request,
    )
    return result


@router.delete("/{exception_id}", status_code=204)
def delete_exception(
    exception_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("exceptions:write")),
):
    repo = ControlExceptionRepository(db)
    exc = _get_or_404(repo, exception_id)
    before = _snap(exc)
    repo.delete(exc)
    AuditService(db).log(
        "EXCEPTION_DELETED", actor=current_user,
        resource_type="Exception", resource_id=exception_id,
        before=before, request=request,
    )
