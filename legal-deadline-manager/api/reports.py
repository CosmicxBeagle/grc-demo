"""Reports API — on-demand attorney sheet generation."""
from datetime import date
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter()


@router.post("/generate")
def generate_report(report_date: date = None):
    """Manually trigger attorney sheet generation for a given date."""
    from scheduler.jobs import job_generate_attorney_sheet
    job_generate_attorney_sheet()
    return {"message": "Report generation triggered."}


@router.get("/download/{report_date}")
def download_report(report_date: str):
    """Download a previously generated attorney sheet PDF."""
    from config import get_settings
    settings = get_settings()
    pdf_path = Path(settings.daily_sheet_save_path) / f"{report_date}.pdf"
    if not pdf_path.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Report for {report_date} not found.")
    return FileResponse(path=str(pdf_path), media_type="application/pdf",
                        filename=f"DailyDeadlines-{report_date}.pdf")
