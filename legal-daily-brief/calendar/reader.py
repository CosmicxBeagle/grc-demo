"""
Outlook Calendar Reader
Pulls events from the next N days via Microsoft Graph API and
splits them into two buckets:
  - deadlines:  events whose subject starts with the DD: prefix
  - other:      everything else (meetings, calls, reminders, etc.)

Each event is returned as a simple CalendarEvent dataclass.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timezone, timedelta
from typing import Optional
import httpx
from loguru import logger

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


@dataclass
class CalendarEvent:
    graph_id: str
    subject: str          # raw subject from Outlook
    start: date           # date only (all-day or extracted from datetime)
    start_dt: Optional[datetime]   # full datetime if not all-day
    is_all_day: bool
    location: str
    body_preview: str
    days_until: int       # negative = past, 0 = today, positive = future

    # Populated only for DD: events
    is_deadline: bool = False
    client_name: str = ""   # parsed from "DD: Client Name — Task"
    task_label: str = ""    # parsed from "DD: Client Name — Task"


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


def _parse_event_date(event: dict) -> tuple[date, Optional[datetime], bool]:
    """Extract a usable date from a Graph calendar event."""
    start_obj = event.get("start", {})
    is_all_day = event.get("isAllDay", False)

    raw = start_obj.get("dateTime") or start_obj.get("date")
    if not raw:
        return date.today(), None, True

    if "T" in raw:
        # datetime string — parse and convert to local date
        try:
            tz_str = start_obj.get("timeZone", "UTC")
            from dateutil import parser as dateparser, tz as dateutil_tz
            parsed = dateparser.parse(raw)
            if parsed.tzinfo is None:
                # Treat as the given timezone
                local_tz = dateutil_tz.gettz(tz_str) or dateutil_tz.UTC
                parsed = parsed.replace(tzinfo=local_tz)
            local = parsed.astimezone(dateutil_tz.gettz("America/Chicago"))
            return local.date(), local, False
        except Exception:
            return date.today(), None, False
    else:
        # date-only string (all-day event)
        try:
            from dateutil import parser as dateparser
            return dateparser.parse(raw).date(), None, True
        except Exception:
            return date.today(), None, True


def _parse_deadline_subject(subject: str, prefix: str) -> tuple[str, str]:
    """
    Parse "DD: Client Name — Task description" into (client_name, task_label).
    Handles both "—" (em dash) and "-" as separators.
    Returns ("", full_subject_minus_prefix) if no separator found.
    """
    # Strip the prefix (case-insensitive)
    text = subject[len(prefix):].strip()

    # Try em dash first, then regular dash
    for sep in [" — ", " – ", " - "]:
        if sep in text:
            parts = text.split(sep, 1)
            return parts[0].strip(), parts[1].strip()

    # No separator — treat the whole thing as the task label
    return "", text


def get_calendar_id(token: str, calendar_name: str) -> Optional[str]:
    """Look up a calendar by name and return its Graph ID. None = use default."""
    if not calendar_name:
        return None
    try:
        with httpx.Client() as client:
            r = client.get(f"{GRAPH_BASE}/me/calendars", headers=_headers(token), timeout=15)
            r.raise_for_status()
            for cal in r.json().get("value", []):
                if cal.get("name", "").lower() == calendar_name.lower():
                    logger.debug(f"Found calendar '{calendar_name}' id={cal['id']}")
                    return cal["id"]
        logger.warning(f"Calendar '{calendar_name}' not found — using default calendar.")
    except Exception as e:
        logger.error(f"Could not list calendars: {e}")
    return None


def fetch_events(
    token: str,
    lookahead_days: int = 30,
    deadline_prefix: str = "DD:",
    calendar_name: str = "",
) -> tuple[list[CalendarEvent], list[CalendarEvent]]:
    """
    Fetch all calendar events for the next `lookahead_days` days.

    Returns:
        (deadlines, others)
        deadlines — events whose subject starts with deadline_prefix
        others    — everything else
    """
    today = date.today()
    # Start from yesterday to catch anything already overdue but still on calendar
    window_start = datetime.now(timezone.utc) - timedelta(days=1)
    window_end   = datetime.now(timezone.utc) + timedelta(days=lookahead_days)

    start_str = window_start.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_str   = window_end.strftime("%Y-%m-%dT%H:%M:%SZ")

    calendar_id = get_calendar_id(token, calendar_name)
    base = f"{GRAPH_BASE}/me/calendars/{calendar_id}" if calendar_id else f"{GRAPH_BASE}/me"

    url = (
        f"{base}/calendarView"
        f"?startDateTime={start_str}&endDateTime={end_str}"
        f"&$select=id,subject,start,end,isAllDay,location,bodyPreview"
        f"&$orderby=start/dateTime"
        f"&$top=200"
    )

    raw_events: list[dict] = []
    with httpx.Client() as client:
        while url:
            r = client.get(url, headers=_headers(token), timeout=20)
            if r.status_code == 429:
                import time
                time.sleep(int(r.headers.get("Retry-After", "5")))
                continue
            r.raise_for_status()
            data = r.json()
            raw_events.extend(data.get("value", []))
            url = data.get("@odata.nextLink")

    logger.info(f"Fetched {len(raw_events)} calendar events (next {lookahead_days} days).")

    deadlines: list[CalendarEvent] = []
    others: list[CalendarEvent]    = []
    prefix_lower = deadline_prefix.lower()

    for ev in raw_events:
        subject = (ev.get("subject") or "").strip()
        ev_date, ev_dt, is_all_day = _parse_event_date(ev)
        days_until = (ev_date - today).days

        event = CalendarEvent(
            graph_id=ev.get("id", ""),
            subject=subject,
            start=ev_date,
            start_dt=ev_dt,
            is_all_day=is_all_day,
            location=(ev.get("location") or {}).get("displayName", ""),
            body_preview=ev.get("bodyPreview", ""),
            days_until=days_until,
        )

        if subject.lower().startswith(prefix_lower):
            client_name, task_label = _parse_deadline_subject(subject, deadline_prefix)
            event.is_deadline = True
            event.client_name = client_name
            event.task_label  = task_label or subject
            deadlines.append(event)
        else:
            others.append(event)

    # Sort both by date
    deadlines.sort(key=lambda e: e.start)
    others.sort(key=lambda e: e.start)

    logger.info(f"  → {len(deadlines)} deadlines (DD:), {len(others)} other events.")
    return deadlines, others
