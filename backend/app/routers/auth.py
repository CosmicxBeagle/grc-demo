from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import LoginRequest, TokenResponse
from app.services.services import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Local-only login — just supply a username. No password needed for the demo."""
    return AuthService(db).login(req)
