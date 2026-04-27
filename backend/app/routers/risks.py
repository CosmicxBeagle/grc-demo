import csv
import io
from datetime import date
from fastapi import APIRouter, Depends, Request, Query, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.db.database import get_db
from app.schemas.schemas import RiskCreate, RiskUpdate, RiskOut, RiskControlCreate, PaginatedRiskResponse, RiskHistoryOut
from app.services.services import RiskService
from app.services import audit_service
from app.services import risk_history_service as rh
from app.auth.permissions import require_permission
from app.models.models import User

router = APIRouter(prefix="/risks", tags=["risks"])


def _snap(r) -> dict:
    """Auditable snapshot of a Risk ORM object — only mutable business fields."""
    return {
        "name":                 r.name,
        "description":         r.description,
        "likelihood":          r.likelihood,
        "impact":              r.impact,
        "residual_likelihood": r.residual_likelihood,
        "residual_impact":     r.residual_impact,
        "status":              r.status,
        "managed_start_date":  str(r.managed_start_date) if r.managed_start_date else None,
        "managed_end_date":    str(r.managed_end_date) if r.managed_end_date else None,
        "treatment":           r.treatment,
        "owner":               r.owner,
        "owner_id":            r.owner_id,
        "asset_id":            r.asset_id,
        "threat_id":           r.threat_id,
        "parent_risk_id":      r.parent_risk_id,
    }


# NOTE: static path segments (/by-control, /bulk-import) must be defined BEFORE
# /{risk_id} so FastAPI doesn't treat them as integer path parameters.
@router.get("/by-control/{control_id}", response_model=list[RiskOut])
def risks_for_control(
    control_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:read")),
):
    return RiskService(db).get_risks_for_control(control_id)


# ── CSV bulk import ───────────────────────────────────────────────────────────

_VALID_TREATMENTS = {"mitigate", "accept", "transfer", "avoid"}
_VALID_STATUSES   = {"new", "closed", "managed_with_dates", "managed_without_dates", "unmanaged"}


def _parse_opt_int(val: str | None) -> int | None:
    v = (val or "").strip()
    return int(v) if v else None


def _parse_opt_date(val: str | None) -> date | None:
    v = (val or "").strip()
    if not v:
        return None
    try:
        return date.fromisoformat(v)
    except ValueError:
        return None


@router.post("/bulk-import")
async def bulk_import_risks(
    request:      Request,
    file:         UploadFile = File(...),
    db:           Session    = Depends(get_db),
    current_user: User       = Depends(require_permission("risks:write")),
):
    """Import multiple risks from a UTF-8 CSV file.

    Expected columns (header row required):
      name, description, likelihood, impact,
      residual_likelihood, residual_impact,
      treatment, status, owner,
      managed_start_date, managed_end_date

    Only ``name`` is required. Unknown columns are ignored.
    Returns a JSON summary: {created, errors, created_items}.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file.")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")   # strip BOM if present
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded.")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV appears to be empty.")

    # Normalise header names to lowercase stripped
    reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]

    created_items: list[dict] = []
    errors:        list[dict] = []

    for i, row in enumerate(reader, start=2):   # row 1 = header
        name = (row.get("name") or "").strip()
        if not name:
            errors.append({"row": i, "name": "", "error": "name is required"})
            continue

        # Parse numeric fields with validation
        try:
            likelihood = max(1, min(5, int(row.get("likelihood") or 3)))
            impact     = max(1, min(5, int(row.get("impact") or 3)))
        except ValueError:
            errors.append({"row": i, "name": name, "error": "likelihood and impact must be integers 1–5"})
            continue

        try:
            r_like = _parse_opt_int(row.get("residual_likelihood"))
            r_imp  = _parse_opt_int(row.get("residual_impact"))
            if r_like is not None:
                r_like = max(1, min(5, r_like))
            if r_imp is not None:
                r_imp = max(1, min(5, r_imp))
        except ValueError:
            errors.append({"row": i, "name": name, "error": "residual values must be integers 1–5"})
            continue

        treatment = (row.get("treatment") or "mitigate").strip().lower()
        if treatment not in _VALID_TREATMENTS:
            treatment = "mitigate"

        status = (row.get("status") or "new").strip().lower()
        if status not in _VALID_STATUSES:
            status = "new"

        managed_start = _parse_opt_date(row.get("managed_start_date"))
        managed_end   = _parse_opt_date(row.get("managed_end_date"))

        data = RiskCreate(
            name=name,
            description=(row.get("description") or "").strip() or None,
            likelihood=likelihood,
            impact=impact,
            residual_likelihood=r_like,
            residual_impact=r_imp,
            treatment=treatment,
            status=status,
            managed_start_date=managed_start,
            managed_end_date=managed_end,
            owner=(row.get("owner") or "").strip() or None,
        )

        try:
            result = RiskService(db).create(data)
            audit_service.emit(
                db, "RISK_CREATED", actor=current_user,
                resource_type="Risk", resource_id=result.id, resource_name=result.name,
                after=_snap(result), request=request,
            )
            created_items.append({"row": i, "id": result.id, "name": result.name})
        except Exception as exc:
            errors.append({"row": i, "name": name, "error": str(exc)})

    return {
        "created":       len(created_items),
        "errors":        errors,
        "created_items": created_items,
    }


@router.get("", response_model=PaginatedRiskResponse)
def list_risks(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:read")),
    status: Optional[str] = Query(None, description="Filter by a single status value"),
    statuses: Optional[str] = Query(None, description="Comma-separated status values, e.g. new,unmanaged"),
    sort_by: str = Query("created_at", description="Column to sort by: name|likelihood|impact|status|created_at|updated_at"),
    sort_dir: str = Query("desc", description="Sort direction: asc|desc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000),
):
    statuses_list = [s.strip() for s in statuses.split(",")] if statuses else None
    items, total = RiskService(db).list_all(
        status=status,
        statuses=statuses_list,
        sort_by=sort_by,
        sort_dir=sort_dir,
        skip=skip,
        limit=limit,
    )
    return PaginatedRiskResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/{risk_id}", response_model=RiskOut)
def get_risk(
    risk_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:read")),
):
    return RiskService(db).get(risk_id)


@router.get("/{risk_id}/history", response_model=list[RiskHistoryOut])
def get_risk_history(
    risk_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("risks:read")),
):
    """Unified chronological event log for a risk."""
    return rh.get_unified_history(db, risk_id)


@router.post("", response_model=RiskOut, status_code=201)
def create_risk(
    data: RiskCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    result = RiskService(db).create(data)
    audit_service.emit(db,
        "RISK_CREATED", actor=current_user,
        resource_type="Risk", resource_id=result.id, resource_name=result.name,
        after=_snap(result), request=request,
    )
    rh.log_event(
        db, result.id, "created", current_user,
        summary=f"Risk created by {current_user.display_name}",
        new_status=result.status,
    )
    db.commit()
    return result


@router.patch("/{risk_id}", response_model=RiskOut)
def update_risk(
    risk_id: int,
    data: RiskUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    svc = RiskService(db)
    before_obj = svc.get(risk_id)
    before = _snap(before_obj)
    result = svc.update(risk_id, data)
    after = _snap(result)
    audit_service.emit(db,
        "RISK_UPDATED", actor=current_user,
        resource_type="Risk", resource_id=result.id, resource_name=result.name,
        before=before, after=after, request=request,
    )
    changes = rh.diff_snaps(before, after)
    if changes:
        rh.log_event(
            db, result.id, "field_changed", current_user,
            summary=rh.make_summary(current_user.display_name, changes),
            old_status=before.get("status"),
            new_status=after.get("status") if "status" in changes else None,
            changed_fields=changes,
        )
        db.commit()
    return result


@router.delete("/{risk_id}", status_code=204)
def delete_risk(
    risk_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    svc = RiskService(db)
    obj = svc.get(risk_id)
    before = _snap(obj)
    name = obj.name
    svc.delete(risk_id)
    audit_service.emit(db,
        "RISK_DELETED", actor=current_user,
        resource_type="Risk", resource_id=risk_id, resource_name=name,
        before=before, request=request,
    )


@router.post("/{risk_id}/controls", status_code=201)
def link_control(
    risk_id: int,
    data: RiskControlCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    result = RiskService(db).add_control(risk_id, data.control_id, data.notes)
    audit_service.emit(db,
        "RISK_CONTROL_LINKED", actor=current_user,
        resource_type="Risk", resource_id=risk_id,
        after={"control_id": data.control_id}, request=request,
    )
    return result


@router.delete("/{risk_id}/controls/{control_id}", status_code=204)
def unlink_control(
    risk_id: int,
    control_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("risks:write")),
):
    RiskService(db).remove_control(risk_id, control_id)
    audit_service.emit(db,
        "RISK_CONTROL_UNLINKED", actor=current_user,
        resource_type="Risk", resource_id=risk_id,
        before={"control_id": control_id}, request=request,
    )
