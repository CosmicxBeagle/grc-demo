"""Deadlines API — list, create, complete, and run the deadline engine."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict
from database.connection import get_db
from database.models import Deadline, Case, DeadlineStatus, DeadlineSource, Reminder, ReminderType
from core.deadline_engine import DeadlineEngine
from core.date_utils import calculate_reminder_dates

router = APIRouter()


class DeadlineCreate(BaseModel):
    case_id: int
    label: str
    deadline_date: date
    description: Optional[str] = None
    is_critical: bool = False
    source: DeadlineSource = DeadlineSource.MANUAL


class CalculateDeadlinesRequest(BaseModel):
    case_id: int
    trigger_dates: Dict[str, date]           # {"trial_date": "2027-01-12", ...}
    scheduling_order_dates: Optional[Dict[str, date]] = None


@router.get("/")
def list_deadlines(
    case_id: Optional[int] = None,
    status: Optional[str] = "pending",
    days_ahead: Optional[int] = 30,
    db: Session = Depends(get_db)
):
    """List deadlines, optionally filtered by case and lookahead window."""
    from datetime import timedelta
    query = db.query(Deadline, Case).join(Case)
    if case_id:
        query = query.filter(Deadline.case_id == case_id)
    if status:
        query = query.filter(Deadline.status == status)
    if days_ahead:
        cutoff = date.today() + timedelta(days=days_ahead)
        query = query.filter(Deadline.deadline_date <= cutoff)
    query = query.order_by(Deadline.deadline_date, Deadline.display_order)

    return [
        {
            "id": dl.id, "case_id": dl.case_id, "case_name": case.case_name,
            "case_number": case.case_number, "court": case.court_name,
            "label": dl.label, "deadline_date": dl.deadline_date.isoformat(),
            "status": dl.status.value, "is_critical": dl.is_critical,
            "has_conflict": dl.has_conflict, "conflict_note": dl.conflict_note,
            "days_until": (dl.deadline_date - date.today()).days,
        }
        for dl, case in query.all()
    ]


@router.post("/", status_code=201)
def create_deadline(data: DeadlineCreate, db: Session = Depends(get_db)):
    """Manually create a deadline and auto-generate its reminders."""
    case = db.query(Case).filter(Case.id == data.case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    dl = Deadline(
        case_id=data.case_id,
        label=data.label,
        deadline_date=data.deadline_date,
        description=data.description,
        is_critical=data.is_critical,
        source=data.source,
        status=DeadlineStatus.PENDING,
    )
    db.add(dl)
    db.flush()   # Get dl.id before creating reminders

    # Auto-create reminders
    reminder_dates = calculate_reminder_dates(
        data.deadline_date,
        holiday_set="federal" if case.court_type.value == "federal" else "oklahoma_state"
    )
    for rtype, rdate in reminder_dates.items():
        r = Reminder(
            deadline_id=dl.id,
            reminder_type=ReminderType(rtype),
            reminder_date=rdate,
            label=f"{rtype.replace('_', '-').title()} Warning: {data.label}",
        )
        db.add(r)

    db.commit()
    return {"id": dl.id, "deadline_date": dl.deadline_date.isoformat(), "reminders": {k: v.isoformat() for k, v in reminder_dates.items()}}


@router.post("/calculate")
def calculate_from_rules(data: CalculateDeadlinesRequest, db: Session = Depends(get_db)):
    """
    Run the deadline engine for a case and return all calculated deadlines.
    Does NOT save to DB — returns results for paralegal review first.
    Call POST /deadlines/save-calculated to persist after review.
    """
    case = db.query(Case).filter(Case.id == data.case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    engine = DeadlineEngine(jurisdiction=case.jurisdiction.value)
    deadlines = engine.calculate_all(data.trigger_dates, data.scheduling_order_dates)
    conflicts = engine.detect_conflicts(deadlines)

    return {
        "deadlines": [d.to_dict() for d in deadlines],
        "conflict_count": len(conflicts),
        "conflicts": [d.to_dict() for d in conflicts],
    }


@router.patch("/{deadline_id}/complete")
def complete_deadline(deadline_id: int, completed_by: str = "paralegal", db: Session = Depends(get_db)):
    """Mark a deadline as completed."""
    from datetime import datetime
    dl = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    if not dl:
        raise HTTPException(status_code=404, detail="Deadline not found")
    dl.status = DeadlineStatus.COMPLETED
    dl.completed_at = datetime.utcnow()
    dl.completed_by = completed_by
    db.commit()
    return {"message": f"Deadline {deadline_id} marked complete."}
