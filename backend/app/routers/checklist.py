from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.db.database import get_db
from app.schemas.schemas import ChecklistItemCreate, ChecklistItemUpdate, ChecklistItemOut
from app.auth.permissions import require_permission
from app.models.models import User, TestChecklistItem, TestAssignment

router = APIRouter(prefix="/assignments/{assignment_id}/checklist", tags=["checklist"])


def _get_assignment(assignment_id: int, db: Session) -> TestAssignment:
    a = db.query(TestAssignment).filter(TestAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return a


@router.get("", response_model=list[ChecklistItemOut])
def list_items(
    assignment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("tests:read")),
):
    _get_assignment(assignment_id, db)
    return (
        db.query(TestChecklistItem)
        .filter(TestChecklistItem.assignment_id == assignment_id)
        .order_by(TestChecklistItem.sort_order, TestChecklistItem.id)
        .all()
    )


@router.post("", response_model=ChecklistItemOut, status_code=201)
def create_item(
    assignment_id: int,
    data: ChecklistItemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("tests:write")),
):
    _get_assignment(assignment_id, db)
    item = TestChecklistItem(
        assignment_id=assignment_id,
        title=data.title,
        sort_order=data.sort_order,
        created_at=datetime.utcnow(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=ChecklistItemOut)
def update_item(
    assignment_id: int,
    item_id: int,
    data: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("tests:write")),
):
    item = db.query(TestChecklistItem).filter(
        TestChecklistItem.id == item_id,
        TestChecklistItem.assignment_id == assignment_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    if data.title is not None:
        item.title = data.title
    if data.sort_order is not None:
        item.sort_order = data.sort_order
    if data.completed is not None:
        item.completed = data.completed
        item.completed_at = datetime.utcnow() if data.completed else None

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(
    assignment_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("tests:write")),
):
    item = db.query(TestChecklistItem).filter(
        TestChecklistItem.id == item_id,
        TestChecklistItem.assignment_id == assignment_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    db.delete(item)
    db.commit()
