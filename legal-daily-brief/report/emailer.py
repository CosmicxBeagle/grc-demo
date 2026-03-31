"""
Send the daily brief PDF as an email via Microsoft Graph (Mail.Send).
No SMTP server or app password needed — uses the same token as the calendar read.
"""

import base64
from datetime import date, datetime
from pathlib import Path
from loguru import logger
import httpx


def send(pdf_path: Path, to_email: str, report_date: date, firm_name: str = "") -> bool:
    """
    Email the brief PDF to `to_email`.
    Returns True on success, False on failure.
    """
    from auth.graph_auth import get_token

    token = get_token()
    date_str = report_date.strftime("%A, %B %d, %Y")
    subject  = f"Daily Work Brief — {date_str}"

    body_html = f"""
    <p style="font-family:Arial;font-size:13px;">
      Good morning — your daily work brief for <b>{date_str}</b> is attached.
    </p>
    <p style="font-family:Arial;font-size:11px;color:#888;margin-top:16px;">
      Generated automatically at {datetime.now().strftime('%I:%M %p')} by Legal Daily Brief.
      {('&nbsp;·&nbsp;' + firm_name) if firm_name else ''}
    </p>
    """

    attachment_bytes = pdf_path.read_bytes()
    attachment_b64   = base64.b64encode(attachment_bytes).decode()
    attachment_name  = f"DailyBrief-{report_date.isoformat()}{pdf_path.suffix}"

    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": body_html},
            "toRecipients": [{"emailAddress": {"address": to_email}}],
            "attachments": [{
                "@odata.type": "#microsoft.graph.fileAttachment",
                "name": attachment_name,
                "contentType": "application/pdf" if pdf_path.suffix == ".pdf" else "text/html",
                "contentBytes": attachment_b64,
            }],
        },
        "saveToSentItems": True,
    }

    try:
        with httpx.Client() as client:
            r = client.post(
                "https://graph.microsoft.com/v1.0/me/sendMail",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=payload,
                timeout=30,
            )
            r.raise_for_status()
        logger.info(f"Brief emailed to {to_email}")
        return True
    except httpx.HTTPStatusError as e:
        logger.error(f"Email failed ({e.response.status_code}): {e.response.text}")
        return False
    except Exception as e:
        logger.error(f"Email failed: {e}")
        return False
