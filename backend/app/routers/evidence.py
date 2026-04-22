from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, Request, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import EvidenceOut, EvidenceListItem, PaginatedEvidenceResponse
from app.services.services import EvidenceService
from app.services import audit_service
from app.auth.permissions import require_permission
from app.models.models import User
from app.repositories.repositories import EvidenceRepository

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get("", response_model=PaginatedEvidenceResponse)
def list_evidence(
    q: Optional[str] = Query(None, description="Search across filename, control, cycle"),
    test_cycle_id: Optional[list[int]] = Query(None),
    control_prefix: Optional[list[str]] = Query(None),
    date_from: Optional[str] = Query(None, description="ISO date, e.g. 2024-01-01"),
    date_to: Optional[str] = Query(None),
    sort_by: str = Query("uploaded_at", pattern="^(original_filename|uploaded_at|control|cycle)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("evidence:read")),
):
    repo = EvidenceRepository(db)
    items, total = repo.list_paginated(
        q=q,
        test_cycle_ids=test_cycle_id,
        control_prefixes=control_prefix,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )

    def _to_item(ev) -> EvidenceListItem:
        assignment = ev.assignment
        control = assignment.control if assignment else None
        cycle = assignment.test_cycle if assignment else None
        uploader = ev.uploader
        return EvidenceListItem(
            id=ev.id,
            original_filename=ev.original_filename,
            description=ev.description,
            file_size=ev.file_size,
            uploaded_at=ev.uploaded_at,
            uploaded_by=ev.uploaded_by,
            uploader_name=uploader.display_name if uploader else None,
            uploader_email=uploader.email if uploader else None,
            assignment_id=ev.assignment_id,
            control_id=control.control_id if control else None,
            control_title=control.title if control else None,
            test_cycle_id=cycle.id if cycle else None,
            test_cycle_name=cycle.name if cycle else None,
        )

    return PaginatedEvidenceResponse(
        items=[_to_item(ev) for ev in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=EvidenceOut, status_code=201)
async def upload_evidence(
    assignment_id: int = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:write")),
):
    result = await EvidenceService(db).upload_evidence(
        assignment_id=assignment_id,
        file=file,
        description=description,
        uploader_id=current_user.id,
    )
    audit_service.emit(db,
        "EVIDENCE_UPLOADED", actor=current_user,
        resource_type="Evidence", resource_id=result.id,
        resource_name=result.original_filename,
        after={"assignment_id": assignment_id, "filename": result.original_filename,
               "file_size": result.file_size},
        request=request,
    )
    return result


@router.get("/{evidence_id}/download")
def download_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("evidence:read")),
):
    data, content_type, filename = EvidenceService(db).download_evidence(evidence_id)
    safe_name = filename.replace('"', "").replace("\r", "").replace("\n", "")
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.delete("/{evidence_id}", status_code=204)
def delete_evidence(
    evidence_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:write")),
):
    svc = EvidenceService(db)
    ev = svc.evidence_repo.get_by_id(evidence_id)
    name = ev.original_filename if ev else str(evidence_id)
    svc.delete_evidence(evidence_id)
    audit_service.emit(db,
        "EVIDENCE_DELETED", actor=current_user,
        resource_type="Evidence", resource_id=evidence_id,
        resource_name=name, request=request,
    )
