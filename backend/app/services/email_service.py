"""
Email delivery service.

In demo/local mode (no SMTP configured) emails are logged to stdout so you
can see exactly what would have been delivered.  Set SMTP_HOST + SMTP_USER +
SMTP_PASS in your .env to enable real delivery.
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body_html: str) -> bool:
    """
    Send an HTML email.  Returns True if sent (or logged in demo mode).
    """
    if settings.smtp_host and settings.smtp_user:
        return _send_smtp(to, subject, body_html)
    else:
        _log_email(to, subject, body_html)
        return True


def _send_smtp(to: str, subject: str, body_html: str) -> bool:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.email_from
    msg["To"]      = to
    msg.attach(MIMEText(body_html, "html"))
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_pass)
            server.sendmail(settings.email_from, [to], msg.as_string())
        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        return False


def _log_email(to: str, subject: str, body_html: str) -> None:
    """Demo-mode: print the email so it's visible in dev logs."""
    logger.info(
        "\n" + "=" * 70 +
        "\n[EMAIL — demo mode, not sent]\n"
        f"To:      {to}\n"
        f"From:    {settings.email_from}\n"
        f"Subject: {subject}\n"
        "Body (HTML):\n" + body_html +
        "\n" + "=" * 70
    )


def build_risk_review_email(
    owner_name: str,
    cycle_label: str,
    risks: list[dict],
    cycle_id: int,
) -> tuple[str, str]:
    """
    Build subject + HTML body for a risk review request email.

    risks: list of dicts with keys: name, score, status, treatment, last_updated
    Returns (subject, body_html).
    """
    subject = f"Action Required: {cycle_label} — Risk Review"
    link    = f"{settings.app_base_url}/risk-reviews/{cycle_id}"

    rows = "\n".join(
        f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">{r['name']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">{r['score']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">{r['tier'].upper()}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">{r['status'].title()}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">{r['treatment'].title()}</td>
        </tr>"""
        for r in risks
    )

    body_html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#1f2937;margin:0;padding:0">
  <div style="max-width:680px;margin:32px auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">

    <div style="background:#1e3a5f;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px">GRC Platform — Risk Review Request</h1>
    </div>

    <div style="padding:32px">
      <p>Hi {owner_name},</p>
      <p>
        Please review the risks assigned to you as part of the
        <strong>{cycle_label}</strong>.
        We need your status update for each risk listed below.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:10px 12px;text-align:left;font-weight:600">Risk</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600">Score</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600">Tier</th>
            <th style="padding:10px 12px;text-align:left;font-weight:600">Status</th>
            <th style="padding:10px 12px;text-align:left;font-weight:600">Treatment</th>
          </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
      </table>

      <p>To submit your updates, log in to the GRC platform:</p>
      <p style="text-align:center;margin:24px 0">
        <a href="{link}"
           style="background:#1e3a5f;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
          Review My Risks
        </a>
      </p>

      <p style="color:#6b7280;font-size:13px">
        Please complete your review within 7 days.
        If you have questions, contact your GRC team.
      </p>
    </div>

    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0">
        This is an automated notification from the GRC Control Testing Platform.
      </p>
    </div>
  </div>
</body>
</html>
"""
    return subject, body_html


def build_reminder_email(
    owner_name: str,
    cycle_label: str,
    pending_risks: list[dict],
    cycle_id: int,
    days_outstanding: int,
) -> tuple[str, str]:
    """Build subject + HTML body for a 7-day reminder email."""
    subject = f"Reminder ({days_outstanding}d): {cycle_label} — Risk Review Pending"
    link    = f"{settings.app_base_url}/risk-reviews/{cycle_id}"

    rows = "\n".join(
        f'<li style="margin-bottom:6px"><strong>{r["name"]}</strong> — {r["tier"].upper()} ({r["status"]})</li>'
        for r in pending_risks
    )

    body_html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#1f2937;margin:0;padding:0">
  <div style="max-width:680px;margin:32px auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <div style="background:#1e3a5f;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px">Risk Review — Action Still Required</h1>
    </div>
    <div style="padding:32px">
      <p>Hi {owner_name},</p>
      <p>
        This is a reminder that your risk updates for <strong>{cycle_label}</strong>
        are still pending ({days_outstanding} days since the initial request).
      </p>
      <p>Risks awaiting your update:</p>
      <ul style="font-size:14px">{rows}</ul>
      <p style="text-align:center;margin:24px 0">
        <a href="{link}"
           style="background:#1e3a5f;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
          Submit My Updates
        </a>
      </p>
    </div>
  </div>
</body>
</html>
"""
    return subject, body_html
