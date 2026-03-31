"""Cases CRUD API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database.connection import get_db
from database.models import Case, CaseStatus, CaseType, CourtType, Jurisdiction

router = APIRouter()


class CaseCreate(BaseModel):
    case_name: str
    case_number: str
    court_name: str
    jurisdiction: Jurisdiction
    court_type: CourtType
    case_type: CaseType = CaseType.CIVIL_LITIGATION
    client_name: Optional[str] = None
    assigned_attorney: Optional[str] = None
    assigned_paralegal: Optional[str] = None
    notes: Optional[str] = None


@router.get("/")
def list_cases(status: Optional[str] = "active", db: Session = Depends(get_db)):
    """List all cases, optionally filtered by status."""
    query = db.query(Case)
    if status:
        query = query.filter(Case.status == status)
    return [{"id": c.id, "case_name": c.case_name, "case_number": c.case_number,
             "court_name": c.court_name, "jurisdiction": c.jurisdiction,
             "status": c.status, "case_type": c.case_type} for c in query.all()]


@router.post("/", status_code=201)
def create_case(data: CaseCreate, db: Session = Depends(get_db)):
    """Create a new case record."""
    case = Case(**data.model_dump())
    db.add(case)
    db.commit()
    db.refresh(case)
    return {"id": case.id, "case_name": case.case_name}


@router.get("/{case_id}")
def get_case(case_id: int, db: Session = Depends(get_db)):
    """Get a single case with all its deadlines."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"id": case.id, "case_name": case.case_name, "case_number": case.case_number,
            "court_name": case.court_name, "jurisdiction": case.jurisdiction.value,
            "case_type": case.case_type.value, "status": case.status.value,
            "client_name": case.client_name, "notes": case.notes}


@router.delete("/{case_id}")
def delete_case(case_id: int, db: Session = Depends(get_db)):
    """Soft-delete a case (set status to closed)."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    case.status = CaseStatus.CLOSED
    db.commit()
    return {"message": f"Case {case_id} closed."}
