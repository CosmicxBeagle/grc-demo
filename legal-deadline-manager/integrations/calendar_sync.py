"""
Microsoft Outlook Calendar Sync
Pushes deadline events and reminder events to the user's Outlook calendar
via Microsoft Graph API.

Graph endpoint: POST /me/calendars/{id}/events
Scope required: Calendars.ReadWrite (delegated)

Key behaviors:
  - Uses transactionId (UUID) to prevent duplicate events on retry
  - Stores Graph event IDs in outlook_sync_records for update/delete
  - Creates 3 calendar events per deadline: same-day, 4-day warning, 30-day warning
  - Uses Graph delta query to read existing calendar events on first run
"""

import uuid
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict

import httpx
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from auth.msal_client import get_access_token
from config import get_settings

settings = get_settings()

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


# ---------------------------------------------------------------------------
# HTTP Client Helpers
# ---------------------------------------------------------------------------

def _get_headers() -> dict:
    token = get_access_token()
    if not token:
        raise RuntimeError("Not authenticated. Call /auth/login first.")
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type(httpx.HTTPStatusError),
)
def _post(url: str, payload: dict) -> dict:
    with httpx.Client() as client:
        response = client.post(url, headers=_get_headers(), json=payload, timeout=30)
        if response.status_code == 429:  # Throttled
            retry_after = int(response.headers.get("Retry-After", "10"))
            logger.warning(f"Graph API throttled. Retry after {retry_after}s.")
            import time; time.sleep(retry_after)
            response.raise_for_status()
        response.raise_for_status()
        return response.json()


def _patch(url: str, payload: dict) -> dict:
    with httpx.Client() as client:
        response = client.patch(url, headers=_get_headers(), json=payload, timeout=30)
        response.raise_for_status()
        return response.json()


def _delete(url: str) -> None:
    with httpx.Client() as client:
        response = client.delete(url, headers=_get_headers(), timeout=30)
        if response.status_code != 404:  # Ignore if already deleted
            response.raise_for_status()


# ---------------------------------------------------------------------------
# Calendar Event Creation
# ---------------------------------------------------------------------------

def _deadline_to_event(
    case_name: str,
    case_number: str,
    court: str,
    label: str,
    event_date: date,
    description: str,
    is_reminder: bool = False,
    reminder_days: Optional[int] = None,
    transaction_id: Optional[str] = None,
) -> dict:
    """Build a Graph API calendar event payload for a deadline or reminder."""

    # Event subject
    if is_reminder and reminder_days:
        subject = f"⚠️ {reminder_days}-Day Warning: {label} — {case_name} ({case_number})"
    else:
        subject = f"📋 DEADLINE: {label} — {case_name} ({case_number})"

    # All-day event
    date_str = event_date.isoformat()

    body_html = f"""
    <b>Case:</b> {case_name} ({case_number})<br>
    <b>Court:</b> {court}<br>
    <b>Deadline:</b> {label}<br>
    <br>
    {description or ""}
    """

    event = {
        "subject": subject,
        "body": {
            "contentType": "HTML",
            "content": body_html,
        },
        "start": {"dateTime": f"{date_str}T08:00:00", "timeZone": "America/Chicago"},
        "end": {"dateTime": f"{date_str}T08:30:00", "timeZone": "America/Chicago"},
        "isAllDay": False,
        "showAs": "free",
        "isReminderOn": True,
        "reminderMinutesBeforeStart": 480,   # 8 hours before
        "categories": ["Legal Deadline"],
    }

    if transaction_id:
        event["transactionId"] = transaction_id   # Prevents duplicate on retry

    return event


def create_deadline_event(
    case_name: str,
    case_number: str,
    court: str,
    label: str,
    deadline_date: date,
    description: str,
    transaction_id: Optional[str] = None,
    calendar_id: Optional[str] = None,
) -> Optional[str]:
    """
    Create a calendar event for a deadline. Returns the Graph event ID.
    """
    transaction_id = transaction_id or str(uuid.uuid4())
    calendar_id = calendar_id or settings.outlook_calendar_id

    payload = _deadline_to_event(
        case_name, case_number, court, label,
        deadline_date, description,
        transaction_id=transaction_id,
    )

    try:
        if calendar_id:
            url = f"{GRAPH_BASE}/me/calendars/{calendar_id}/events"
        else:
            url = f"{GRAPH_BASE}/me/events"

        result = _post(url, payload)
        event_id = result.get("id")
        logger.info(f"Created calendar event for {label} on {deadline_date}: {event_id}")
        return event_id

    except httpx.HTTPStatusError as e:
        logger.error(f"Failed to create calendar event: {e.response.text}")
        return None


def create_reminder_event(
    case_name: str,
    case_number: str,
    court: str,
    label: str,
    reminder_date: date,
    deadline_date: date,
    reminder_days: int,
    description: str,
    transaction_id: Optional[str] = None,
    calendar_id: Optional[str] = None,
) -> Optional[str]:
    """Create a calendar reminder event (30-day, 4-day warning)."""
    transaction_id = transaction_id or str(uuid.uuid4())
    calendar_id = calendar_id or settings.outlook_calendar_id

    full_label = f"{label} (due {deadline_date.strftime('%b %d, %Y')})"
    payload = _deadline_to_event(
        case_name, case_number, court, full_label,
        reminder_date, description,
        is_reminder=True, reminder_days=reminder_days,
        transaction_id=transaction_id,
    )

    try:
        url = f"{GRAPH_BASE}/me/calendars/{calendar_id}/events" if calendar_id else f"{GRAPH_BASE}/me/events"
        result = _post(url, payload)
        event_id = result.get("id")
        logger.info(f"Created {reminder_days}-day reminder event for {label}: {event_id}")
        return event_id
    except httpx.HTTPStatusError as e:
        logger.error(f"Failed to create reminder event: {e.response.text}")
        return None


def delete_event(event_id: str) -> None:
    """Delete a calendar event (used when a deadline is removed or updated)."""
    try:
        _delete(f"{GRAPH_BASE}/me/events/{event_id}")
        logger.info(f"Deleted calendar event: {event_id}")
    except Exception as e:
        logger.error(f"Failed to delete calendar event {event_id}: {e}")


# ---------------------------------------------------------------------------
# Read Existing Calendar Events (for initial import)
# ---------------------------------------------------------------------------

def fetch_upcoming_deadlines_from_calendar(days_ahead: int = 90) -> List[dict]:
    """
    Read existing Outlook calendar events to find deadlines that may have been
    added manually or by other tools. Returns a list of event dicts.
    Uses calendarView for efficient time-bounded query.
    """
    from datetime import timezone
    start = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    end_dt = datetime.now(timezone.utc) + timedelta(days=days_ahead)
    end = end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    url = (
        f"{GRAPH_BASE}/me/calendarView"
        f"?startDateTime={start}&endDateTime={end}"
        f"&$select=id,subject,start,end,body,categories"
        f"&$top=100"
    )

    events = []
    with httpx.Client() as client:
        while url:
            response = client.get(url, headers=_get_headers(), timeout=30)
            response.raise_for_status()
            data = response.json()
            events.extend(data.get("value", []))
            url = data.get("@odata.nextLink")  # Pagination

    logger.info(f"Fetched {len(events)} calendar events from Outlook.")
    return events
