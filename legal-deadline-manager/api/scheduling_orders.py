"""Scheduling Order intake — upload PDF/DOCX or paste text."""
# TODO (Phase 2): Full implementation
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from database.connection import get_db

router = APIRouter()


@router.post("/upload")
async def upload_scheduling_order(
    case_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a scheduling order PDF or DOCX.
    Phase 1: Stores the file and extracts raw text.
    Phase 2: Extracts trigger dates and runs the deadline engine.
    """
    # TODO: Save file to data/uploads/{case_id}/
    # TODO: Extract text with pdfplumber or python-docx
    # TODO: OCR fallback with pytesseract if text extraction fails
    # TODO: Run date extractor regex against raw text
    # TODO: Return extracted dates for paralegal review
    return {"message": "Upload endpoint — Phase 2 implementation pending", "filename": file.filename}


@router.post("/paste")
async def paste_scheduling_order(
    case_id: int = Form(...),
    text: str = Form(...),
    db: Session = Depends(get_db),
):
    """Accept scheduling order text via paste and extract dates."""
    # TODO: Run date extractor against pasted text
    return {"message": "Paste endpoint — Phase 2 implementation pending"}
