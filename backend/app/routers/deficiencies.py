from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import DeficiencyCreate, DeficiencyUpdate, DeficiencyOut
from app.services.services import DeficiencyService
from app.auth.local_auth import get_current_user
from app.models.models import User

router = APIRouter(prefix="/deficiencies", tags=["deficiencies"])


@router.get("", response_model=list[DeficiencyOut])
def list_deficiencies(
    status: str = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return DeficiencyService(db).list_all(status)


@router.post("", response_model=DeficiencyOut, status_code=201)
def create_deficiency(
    data: DeficiencyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return DeficiencyService(db).create(data)


@router.patch("/{deficiency_id}", response_model=DeficiencyOut)
def update_deficiency(
    deficiency_id: int,
    data: DeficiencyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return DeficiencyService(db).update(deficiency_id, data)


@router.delete("/{deficiency_id}", status_code=204)
def delete_deficiency(
    deficiency_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    DeficiencyService(db).delete(deficiency_id)
