from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import (
    DeficiencyCreate, DeficiencyUpdate, DeficiencyOut,
    PromoteToRiskRequest, LinkRiskRequest,
    RetestCreate, RetestWaive,
)
from app.services.services import DeficiencyService
from app.services import audit_service
from app.services.retest_service import assert_can_close, create_retest_assignment, waive_retest
from app.auth.permissions import require_permission
from app.models.models import User, Risk, Deficiency
from app.schemas.schemas import TestAssignmentOut

router = APIRouter(prefix="/deficiencies", tags=["deficiencies"])

# Severity → default likelihood when promoting to a risk
_SEVERITY_LIKELIHOOD = {"critical": 5, "high": 4, "medium": 3, "low": 2}


def _snap(d) -> dict:
    return {
        "title":            d.title,
        "severity":         d.severity,
        "status":           d.status,
        "remediation_plan": d.remediation_plan,
        "due_date":         str(d.due_date) if d.due_date else None,
        "linked_risk_id":   d.linked_risk_id,
    }


def _get_or_404(svc: DeficiencyService, deficiency_id: int):
    d = svc.get(deficiency_id)  # already raises 404 if missing
    return d


@router.get("", response_model=list[DeficiencyOut])
def list_deficiencies(
    status: str = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("deficiencies:read")),
):
    return DeficiencyService(db).list_all(status)


@router.post("", response_model=DeficiencyOut, status_code=201)
def create_deficiency(
    data: DeficiencyCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("deficiencies:write")),
):
    result = DeficiencyService(db).create(data)
    audit_service.emit(db,
        "DEFICIENCY_CREATED", actor=current_user,
        resource_type="Deficiency", resource_id=result.id, resource_name=result.title,
        after=_snap(result), request=request,
    )
    return result


@router.patch("/{deficiency_id}", response_model=DeficiencyOut)
def update_deficiency(
    deficiency_id: int,
    data: DeficiencyUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("deficiencies:write")),
):
    svc = DeficiencyService(db)
    existing = svc.get(deficiency_id)
    before = _snap(existing)
    # 4A: block closure if re-test has not been done or waived
    if data.status == "remediated":
        assert_can_close(existing)
    result = svc.update(deficiency_id, data)
    audit_service.emit(db,
        "DEFICIENCY_UPDATED", actor=current_user,
        resource_type="Deficiency", resource_id=deficiency_id, resource_name=result.title,
        before=before, after=_snap(result), request=request,
    )
    return result


@router.delete("/{deficiency_id}", status_code=204)
def delete_deficiency(
    deficiency_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("deficiencies:write")),
):
    svc = DeficiencyService(db)
    obj = svc.get(deficiency_id)
    before = _snap(obj)
    name = obj.title
    svc.delete(deficiency_id)
    audit_service.emit(db,
        "DEFICIENCY_DELETED", actor=current_user,
        resource_type="Deficiency", resource_id=deficiency_id, resource_name=name,
        before=before, request=request,
    )


# ── Risk linkage ──────────────────────────────────────────────────────────────

@router.post("/{deficiency_id}/promote-to-risk", response_model=DeficiencyOut)
def promote_to_risk(
    deficiency_id: int,
    payload: PromoteToRiskRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("deficiencies:write")),
):
    """
    Create a new Risk pre-populated from this deficiency and link them together.
    The deficiency severity is used as a default likelihood if not overridden.
    """
    svc = DeficiencyService(db)
    deficiency = _get_or_404(svc, deficiency_id)

    if deficiency.linked_risk_id:
        raise HTTPException(400, "Deficiency is already linked to a risk. Unlink it first.")

    # Create the risk
    risk = Risk(
        name=payload.name,
        description=payload.description,
        likelihood=payload.likelihood,
        impact=payload.impact,
        treatment=payload.treatment or "mitigate",
        owner=payload.owner,
        status="open",
    )
    db.add(risk)
    db.flush()  # get risk.id

    # Link the deficiency
    before = _snap(deficiency)
    deficiency.linked_risk_id = risk.id
    db.commit()
    db.refresh(deficiency)

    audit_service.emit(db,
        "DEFICIENCY_PROMOTED_TO_RISK", actor=current_user,
        resource_type="Deficiency", resource_id=deficiency_id,
        resource_name=deficiency.title,
        before=before, after=_snap(deficiency), request=request,
    )
    audit_service.emit(db,
        "RISK_CREATED", actor=current_user,
        resource_type="Risk", resource_id=risk.id,
        resource_name=risk.name,
        after={"name": risk.name, "source": f"promoted from deficiency #{deficiency_id}"},
        request=request,
    )
    return deficiency


@router.post("/{deficiency_id}/link-risk", response_model=DeficiencyOut)
def link_risk(
    deficiency_id: int,
    payload: LinkRiskRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("deficiencies:write")),
):
    """Link this deficiency to an existing risk."""
    svc = DeficiencyService(db)
    deficiency = _get_or_404(svc, deficiency_id)

    risk = db.query(Risk).filter(Risk.id == payload.risk_id).first()
    if not risk:
        raise HTTPException(404, "Risk not found")

    before = _snap(deficiency)
    deficiency.linked_risk_id = payload.risk_id
    db.commit()
    db.refresh(deficiency)

    audit_service.emit(db,
        "DEFICIENCY_LINKED_TO_RISK", actor=current_user,
        resource_type="Deficiency", resource_id=deficiency_id,
        resource_name=deficiency.title,
        before=before, after=_snap(deficiency), request=request,
    )
    return deficiency


@router.delete("/{deficiency_id}/link-risk", response_model=DeficiencyOut)
def unlink_risk(
    deficiency_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("deficiencies:write")),
):
    """Remove the risk linkage from this deficiency."""
    svc = DeficiencyService(db)
    deficiency = _get_or_404(svc, deficiency_id)

    before = _snap(deficiency)
    deficiency.linked_risk_id = None
    db.commit()
    db.refresh(deficiency)

    audit_service.emit(db,
        "DEFICIENCY_UNLINKED_FROM_RISK", actor=current_user,
        resource_type="Deficiency", resource_id=deficiency_id,
        resource_name=deficiency.title,
        before=before, after=_snap(deficiency), request=request,
    )
    return deficiency


# ── Workstream 4A: Re-test endpoints ─────────────────────────────────────────

@router.post("/{deficiency_id}/create-retest", response_model=TestAssignmentOut, status_code=201)
def create_retest(
    deficiency_id: int,
    data: RetestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("deficiencies:write")),
):
    """Create a re-test assignment for this deficiency."""
    d = db.query(Deficiency).filter(Deficiency.id == deficiency_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Deficiency not found")
    retest = create_retest_assignment(db, d, data.cycle_id, data.assigned_to_user_id, user)
    db.commit()
    from app.repositories.repositories import AssignmentRepository
    return AssignmentRepository(db).get_by_id(retest.id)


@router.post("/{deficiency_id}/waive-retest")
def waive_retest_endpoint(
    deficiency_id: int,
    data: RetestWaive,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("deficiencies:write")),
):
    """Waive the re-test requirement with a documented reason."""
    d = db.query(Deficiency).filter(Deficiency.id == deficiency_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Deficiency not found")
    waive_retest(db, d, data.reason, user)
    db.commit()
    return {"ok": True, "waived_by": user.display_name}
