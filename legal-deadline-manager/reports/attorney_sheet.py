"""
Daily Attorney Sheet Generator
Produces a clean, single-page printable PDF of:
  - All deadlines due TODAY
  - All deadlines due THIS WEEK (grouped by day)
  - All 30-day and 4-day warnings triggering today
  - Overdue items (past-due, highlighted in red)

Designed for a non-technical attorney — print and hand off.
Generated each morning at 7:00 AM by APScheduler.

Uses WeasyPrint (HTML → PDF) for best print fidelity.
"""

import os
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Optional

from jinja2 import Environment, FileSystemLoader
from loguru import logger

from config import get_settings

settings = get_settings()

TEMPLATE_DIR = Path(__file__).parent / "templates"
OUTPUT_DIR = Path(settings.daily_sheet_save_path)


# ---------------------------------------------------------------------------
# Data Models for Template
# ---------------------------------------------------------------------------

class DeadlineRow:
    """A single row on the attorney sheet."""
    def __init__(
        self,
        case_name: str,
        case_number: str,
        court: str,
        label: str,
        deadline_date: date,
        days_until: int,
        is_critical: bool = False,
        is_overdue: bool = False,
        citation: str = "",
        notes: str = "",
    ):
        self.case_name = case_name
        self.case_number = case_number
        self.court = court
        self.label = label
        self.deadline_date = deadline_date
        self.deadline_date_str = deadline_date.strftime("%B %d, %Y")
        self.days_until = days_until
        self.is_critical = is_critical
        self.is_overdue = is_overdue
        self.citation = citation
        self.notes = notes


# ---------------------------------------------------------------------------
# PDF Generation
# ---------------------------------------------------------------------------

def generate_attorney_sheet(
    report_date: Optional[date] = None,
    due_today: Optional[List[DeadlineRow]] = None,
    due_this_week: Optional[Dict[str, List[DeadlineRow]]] = None,
    reminders_30_day: Optional[List[DeadlineRow]] = None,
    reminders_4_day: Optional[List[DeadlineRow]] = None,
    overdue: Optional[List[DeadlineRow]] = None,
    output_path: Optional[Path] = None,
) -> Path:
    """
    Generate the daily attorney PDF sheet.

    Args:
        report_date:     Date for the sheet header (defaults to today)
        due_today:       Deadlines due today
        due_this_week:   Deadlines due this week {date_str: [DeadlineRow, ...]}
        reminders_30_day: 30-day warnings triggering today
        reminders_4_day:  4-day warnings triggering today
        overdue:         Past-due items
        output_path:     Override output file path

    Returns:
        Path to the generated PDF.
    """
    report_date = report_date or date.today()
    due_today = due_today or []
    due_this_week = due_this_week or {}
    reminders_30_day = reminders_30_day or []
    reminders_4_day = reminders_4_day or []
    overdue = overdue or []

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = output_path or OUTPUT_DIR / f"{report_date.isoformat()}.pdf"

    # Render HTML template
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    template = env.get_template("attorney_sheet.html")

    html_content = template.render(
        firm_name=settings.firm_name,
        report_date=report_date,
        report_date_str=report_date.strftime("%A, %B %d, %Y"),
        generated_at=datetime.now().strftime("%I:%M %p"),
        due_today=due_today,
        due_this_week=due_this_week,
        reminders_30_day=reminders_30_day,
        reminders_4_day=reminders_4_day,
        overdue=overdue,
        total_active=len(due_today) + sum(len(v) for v in due_this_week.values()),
    )

    # Generate PDF with WeasyPrint
    try:
        from weasyprint import HTML, CSS
        HTML(string=html_content, base_url=str(TEMPLATE_DIR)).write_pdf(str(output_path))
        logger.info(f"Attorney sheet generated: {output_path}")
        return output_path
    except ImportError:
        # Fallback: save HTML file if WeasyPrint not installed
        html_path = output_path.with_suffix(".html")
        html_path.write_text(html_content, encoding="utf-8")
        logger.warning(f"WeasyPrint not available. Saved HTML instead: {html_path}")
        return html_path


# ---------------------------------------------------------------------------
# Email the Sheet via Microsoft Graph
# ---------------------------------------------------------------------------

def email_attorney_sheet(pdf_path: Path, report_date: Optional[date] = None) -> bool:
    """
    Email the attorney sheet PDF to the attorney via Microsoft Graph API (Mail.Send).
    No SMTP server needed — uses the same Graph token as calendar/tasks.
    """
    import base64
    import httpx
    from auth.msal_client import get_access_token

    report_date = report_date or date.today()
    token = get_access_token()
    if not token:
        logger.error("Cannot email attorney sheet: not authenticated with Microsoft 365.")
        return False

    if not settings.attorney_email:
        logger.warning("ATTORNEY_EMAIL not configured. Skipping email.")
        return False

    # Read and encode the PDF
    pdf_bytes = pdf_path.read_bytes()
    pdf_b64 = base64.b64encode(pdf_bytes).decode()

    date_str = report_date.strftime("%A, %B %d, %Y")
    payload = {
        "message": {
            "subject": f"Daily Deadline Sheet — {date_str}",
            "body": {
                "contentType": "HTML",
                "content": f"""
                <p>Please find attached today's deadline report.</p>
                <p><b>{date_str}</b></p>
                <p style="color:#999;font-size:11px;">
                    Generated automatically by Legal Deadline Manager at {datetime.now().strftime('%I:%M %p')}.
                </p>
                """,
            },
            "toRecipients": [
                {"emailAddress": {"address": settings.attorney_email}}
            ],
            "attachments": [
                {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": f"Daily-Deadlines-{report_date.isoformat()}.pdf",
                    "contentType": "application/pdf",
                    "contentBytes": pdf_b64,
                }
            ],
        },
        "saveToSentItems": True,
    }

    try:
        with httpx.Client() as client:
            response = client.post(
                "https://graph.microsoft.com/v1.0/me/sendMail",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=payload,
                timeout=60,
            )
            response.raise_for_status()
            logger.info(f"Attorney sheet emailed to {settings.attorney_email}")
            return True
    except httpx.HTTPStatusError as e:
        logger.error(f"Failed to email attorney sheet: {e.response.text}")
        return False
