from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import EvidenceOut
from app.services.services import EvidenceService
from app.auth.local_auth import get_current_user
from app.models.models import User

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.post("", response_model=EvidenceOut, status_code=201)
async def upload_evidence(
    assignment_id: int = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await EvidenceService(db).upload_evidence(
        assignment_id=assignment_id,
        file=file,
        description=description,
        uploader_id=current_user.id,
    )


@router.delete("/{evidence_id}", status_code=204)
def delete_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    EvidenceService(db).delete_evidence(evidence_id)
