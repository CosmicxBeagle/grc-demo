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

_FOOTER = "This is an automated notification from the GRC Control Testing Platform."


# ── Delivery ──────────────────────────────────────────────────────────────────

def send_email(to: str, subject: str, body_html: str) -> bool:
    """Send an HTML email. Returns True if sent (or logged in demo mode)."""
    if settings.smtp_host and settings.smtp_user:
        return _send_smtp(to, subject, body_html)
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
    logger.info(
        "\n" + "=" * 70 +
        "\n[EMAIL — demo mode, not sent]\n"
        f"To:      {to}\n"
        f"From:    {settings.email_from}\n"
        f"Subject: {subject}\n"
        "Body (HTML):\n" + body_html +
        "\n" + "=" * 70
    )


# ── Shared template wrapper ───────────────────────────────────────────────────

def _wrap(header_color: str, header_title: str, body_content: str) -> str:
    """Wrap content in the standard GRC email shell."""
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#1f2937;margin:0;padding:0;background:#f3f4f6">
  <div style="max-width:680px;margin:32px auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
    <div style="background:{header_color};padding:24px 32px">
      <p style="color:rgba(255,255,255,.7);margin:0 0 4px;font-size:12px;letter-spacing:.05em;text-transform:uppercase">GRC Control Testing Platform</p>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">{header_title}</h1>
    </div>
    <div style="padding:32px">
{body_content}
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0">{_FOOTER}</p>
    </div>
  </div>
</body>
</html>"""


def _cta_button(href: str, label: str, color: str) -> str:
    return (
        f'<p style="text-align:center;margin:28px 0">'
        f'<a href="{href}" style="background:{color};color:#fff;padding:13px 30px;'
        f'border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">'
        f'{label}</a></p>'
    )


def _info_table(rows: list[tuple[str, str]], label_color: str = "#374151", bg: str = "#f9fafb", alt_bg: str = "#f3f4f6") -> str:
    cells = ""
    for i, (label, value) in enumerate(rows):
        row_bg = alt_bg if i % 2 else bg
        cells += (
            f'<tr style="background:{row_bg}">'
            f'<td style="padding:10px 16px;font-weight:600;color:{label_color};width:35%;font-size:14px">{label}</td>'
            f'<td style="padding:10px 16px;color:#111827;font-size:14px">{value}</td>'
            f'</tr>'
        )
    return (
        f'<table style="width:100%;border-collapse:collapse;margin:20px 0;border-radius:6px;overflow:hidden;border:1px solid #e5e7eb">'
        f'{cells}</table>'
    )


def _highlight_box(content: str, bg: str, border: str, text_color: str = "#111827") -> str:
    return (
        f'<div style="background:{bg};border:1px solid {border};border-radius:6px;'
        f'padding:16px 20px;margin:20px 0;color:{text_color}">{content}</div>'
    )


# ── Email builders ────────────────────────────────────────────────────────────

def build_risk_review_email(
    owner_name: str,
    cycle_label: str,
    risks: list[dict],
    cycle_id: int,
) -> tuple[str, str]:
    subject = f"Action Required: {cycle_label} — Risk Review"
    link    = f"{settings.app_base_url}/risk-reviews/{cycle_id}"

    rows = "\n".join(
        f"""<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px">{r['name']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:14px;font-weight:600">{r['score']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:14px">{r['tier'].upper()}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px">{r['status'].replace('_', ' ').title()}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px">{r['treatment'].replace('_', ' ').title()}</td>
        </tr>"""
        for r in risks
    )

    body = f"""      <p style="margin:0 0 16px">Hi <strong>{owner_name}</strong>,</p>
      <p style="margin:0 0 20px;color:#4b5563">Please review the risks assigned to you as part of the <strong>{cycle_label}</strong>. We need your status update for each risk listed below.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;border-radius:6px;overflow:hidden;border:1px solid #e5e7eb">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:10px 12px;text-align:left;font-weight:600;font-size:13px;color:#374151">Risk</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;font-size:13px;color:#374151">Score</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;font-size:13px;color:#374151">Tier</th>
            <th style="padding:10px 12px;text-align:left;font-weight:600;font-size:13px;color:#374151">Status</th>
            <th style="padding:10px 12px;text-align:left;font-weight:600;font-size:13px;color:#374151">Treatment</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      <p style="margin:0 0 4px;color:#4b5563">Log in to the GRC platform to submit your updates:</p>
      {_cta_button(link, "Review My Risks", "#1e3a5f")}
      <p style="color:#6b7280;font-size:13px;margin:0">Please complete your review within 7 days. If you have questions, contact your GRC team.</p>"""

    return subject, _wrap("#1e3a5f", "Risk Review Request", body)


def build_challenge_email(
    owner_name: str,
    cycle_label: str,
    risk_name: str,
    challenge_reason: str,
    cycle_id: int,
) -> tuple[str, str]:
    """Notify a risk owner that their review update has been challenged by GRC."""
    subject = f"Action Required: GRC Challenge — {risk_name}"
    link    = f"{settings.app_base_url}/risk-reviews/{cycle_id}"

    body = f"""      <p style="margin:0 0 16px">Hi <strong>{owner_name}</strong>,</p>
      <p style="margin:0 0 20px;color:#4b5563">The GRC team has reviewed your update for the <strong>{cycle_label}</strong> cycle and has raised a challenge that requires your response.</p>
      {_info_table([("Risk", risk_name), ("Review Cycle", cycle_label)], label_color="#374151")}
      {_highlight_box(f'<p style="margin:0 0 6px;font-weight:600;color:#991b1b">Challenge Reason</p><p style="margin:0;font-size:14px">{challenge_reason}</p>', "#fef2f2", "#fecaca")}
      <p style="margin:0 0 4px;color:#4b5563">Please log in to review the challenge and submit your response:</p>
      {_cta_button(link, "Respond to Challenge", "#b91c1c")}
      <p style="color:#6b7280;font-size:13px;margin:0">Please respond promptly. If you have questions, contact your GRC team.</p>"""

    return subject, _wrap("#b91c1c", "Risk Review Update Challenged", body)


def build_owner_response_email(
    reviewer_name: str,
    owner_name: str,
    risk_name: str,
    cycle_label: str,
    response_text: str,
    cycle_id: int,
) -> tuple[str, str]:
    """Notify the GRC reviewer that a risk owner has responded to a challenge."""
    subject = f"Owner Response Received: {risk_name}"
    link    = f"{settings.app_base_url}/risk-reviews/{cycle_id}"

    body = f"""      <p style="margin:0 0 16px">Hi <strong>{reviewer_name}</strong>,</p>
      <p style="margin:0 0 20px;color:#4b5563"><strong>{owner_name}</strong> has responded to your challenge on their risk review update. Please review their response and accept or re-challenge.</p>
      {_info_table([("Risk", risk_name), ("Review Cycle", cycle_label), ("Owner", owner_name)], label_color="#374151")}
      {_highlight_box(f'<p style="margin:0 0 6px;font-weight:600;color:#1e40af">Owner Response</p><p style="margin:0;font-size:14px">{response_text}</p>', "#eff6ff", "#bfdbfe")}
      <p style="margin:0 0 4px;color:#4b5563">Log in to accept or continue the review:</p>
      {_cta_button(link, "Review Response", "#1e3a5f")}
      <p style="color:#6b7280;font-size:13px;margin:0">Please respond promptly to keep the review cycle on track.</p>"""

    return subject, _wrap("#1e3a5f", "Owner Response to Challenge", body)


def build_approval_request_email(
    entity_type: str,
    entity_name: str,
    requester_name: str,
    step_label: str,
    approver_name: str,
    workflow_id: int,
) -> tuple[str, str]:
    subject = f"Approval Required: {entity_type.replace('_', ' ').title()} — {entity_name}"
    link    = f"{settings.app_base_url}/approvals"

    body = f"""      <p style="margin:0 0 16px">Hi <strong>{approver_name}</strong>,</p>
      <p style="margin:0 0 20px;color:#4b5563"><strong>{requester_name}</strong> has submitted a <strong>{entity_type.replace('_', ' ')}</strong> that requires your approval.</p>
      {_info_table([("Item", entity_name), ("Approval Step", step_label), ("Submitted By", requester_name)])}
      <p style="margin:0 0 4px;color:#4b5563">To review and approve or reject this item:</p>
      {_cta_button(link, "Review Pending Approvals", "#1e3a5f")}
      <p style="color:#6b7280;font-size:13px;margin:0">Please respond promptly. If you have questions, contact your GRC team.</p>"""

    return subject, _wrap("#1e3a5f", "Approval Required", body)


def build_milestone_overdue_email(
    milestone_title: str,
    risk_name: str,
    due_date: str,
    assignee_name: str,
) -> tuple[str, str]:
    subject = f"Overdue Action Required: Treatment Milestone — {milestone_title}"
    link    = f"{settings.app_base_url}/risks"

    body = f"""      <p style="margin:0 0 16px">Hi <strong>{assignee_name}</strong>,</p>
      <p style="margin:0 0 20px;color:#4b5563">A treatment plan milestone assigned to you is <strong style="color:#b91c1c">past its due date</strong> and has not yet been completed.</p>
      {_info_table([("Milestone", milestone_title), ("Related Risk", risk_name), ("Due Date", f'<span style="color:#b91c1c;font-weight:600">{due_date}</span>')], label_color="#991b1b", bg="#fef2f2", alt_bg="#fee2e2")}
      <p style="margin:0 0 4px;color:#4b5563">Please update the status of this milestone or contact your GRC manager.</p>
      {_cta_button(link, "View Risk Treatment Plans", "#b91c1c")}"""

    return subject, _wrap("#b91c1c", "Overdue Milestone", body)


def build_exception_expiring_email(
    exception_title: str,
    control_name: str,
    expiry_date: str,
    days_left: int,
    requester_name: str,
) -> tuple[str, str]:
    urgency_color  = "#b45309" if days_left > 7 else "#b91c1c"
    urgency_bg     = "#fffbeb" if days_left > 7 else "#fef2f2"
    urgency_border = "#fde68a" if days_left > 7 else "#fecaca"
    label_color    = "#92400e" if days_left > 7 else "#991b1b"
    subject = f"Exception Expiring in {days_left} Day{'s' if days_left != 1 else ''}: {exception_title}"
    link    = f"{settings.app_base_url}/exceptions"

    body = f"""      <p style="margin:0 0 16px">Hi <strong>{requester_name}</strong>,</p>
      <p style="margin:0 0 20px;color:#4b5563">A control exception you requested is expiring in <strong style="color:{urgency_color}">{days_left} day{'s' if days_left != 1 else ''}</strong>. Please review and take action before it lapses.</p>
      {_info_table([("Exception", exception_title), ("Control", control_name), ("Expiry Date", f'<span style="color:{urgency_color};font-weight:600">{expiry_date}</span>'), ("Days Remaining", f'<span style="color:{urgency_color};font-weight:600">{days_left}</span>')], label_color=label_color, bg=urgency_bg, alt_bg=urgency_border)}
      <p style="margin:0 0 4px;color:#4b5563">If this exception should be renewed, please submit a new exception request before it expires.</p>
      {_cta_button(link, "View Exceptions Register", urgency_color)}"""

    return subject, _wrap(urgency_color, "Exception Expiring Soon", body)


def build_reminder_email(
    owner_name: str,
    cycle_label: str,
    pending_risks: list[dict],
    cycle_id: int,
    days_outstanding: int,
) -> tuple[str, str]:
    subject = f"Reminder ({days_outstanding}d): {cycle_label} — Risk Review Pending"
    link    = f"{settings.app_base_url}/risk-reviews/{cycle_id}"

    items = "\n".join(
        f'<li style="margin-bottom:8px;font-size:14px"><strong>{r["name"]}</strong> &mdash; <span style="color:#b45309">{r["tier"].upper()}</span> &mdash; {r["status"].replace("_"," ").title()}</li>'
        for r in pending_risks
    )

    body = f"""      <p style="margin:0 0 16px">Hi <strong>{owner_name}</strong>,</p>
      <p style="margin:0 0 20px;color:#4b5563">This is a reminder that your risk updates for <strong>{cycle_label}</strong> are still pending — it has been <strong>{days_outstanding} day{'s' if days_outstanding != 1 else ''}</strong> since the initial request.</p>
      {_highlight_box(f'<p style="margin:0 0 10px;font-weight:600;color:#92400e">Risks awaiting your update</p><ul style="margin:0;padding-left:20px">{items}</ul>', "#fffbeb", "#fde68a")}
      <p style="margin:0 0 4px;color:#4b5563">Please log in and submit your updates as soon as possible:</p>
      {_cta_button(link, "Submit My Updates", "#1e3a5f")}
      <p style="color:#6b7280;font-size:13px;margin:0">If you have questions, contact your GRC team.</p>"""

    return subject, _wrap("#b45309", "Risk Review Reminder", body)
