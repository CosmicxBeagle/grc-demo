"""
FRCP Rule 6 Date Utilities
Implements the correct calendar-day counting with end-date roll-forward.

Key rules:
  - Rule 6(a)(1): Count calendar days; if the last day falls on a
    Saturday, Sunday, or legal holiday, the period runs until the next
    day that is not a Saturday, Sunday, or legal holiday.
  - Rule 6(d): Mail service adds 3 days; electronic service adds 0 days.
  - All FRCP periods use CALENDAR days (not business days).
  - 2009 amendments eliminated the old "< 11 days skip weekends" rule.

Holiday sets:
  - "federal"         — FRCP / federal court filings
  - "oklahoma_state"  — Oklahoma state court filings (federal + OK state holidays)
  - "arkansas_state"  — Arkansas state court filings (federal + AR state holidays)
"""

from datetime import date, timedelta
from typing import Optional
import holidays


# ---------------------------------------------------------------------------
# Holiday Sets
# ---------------------------------------------------------------------------

def get_holiday_set(holiday_set: str, year: Optional[int] = None) -> set:
    """
    Return a set of holiday dates for the given jurisdiction and year(s).
    If year is None, returns holidays for current year ± 3 years.
    """
    current_year = date.today().year
    years = [year] if year else list(range(current_year - 1, current_year + 5))

    if holiday_set == "federal":
        h = holidays.country_holidays("US", years=years)
    elif holiday_set == "oklahoma_state":
        # Federal holidays + Oklahoma state holidays
        federal = holidays.country_holidays("US", years=years)
        ok_state = holidays.country_holidays("US", subdiv="OK", years=years)
        return set(federal.keys()) | set(ok_state.keys())
    elif holiday_set == "arkansas_state":
        federal = holidays.country_holidays("US", years=years)
        ar_state = holidays.country_holidays("US", subdiv="AR", years=years)
        return set(federal.keys()) | set(ar_state.keys())
    else:
        # Default to federal
        h = holidays.country_holidays("US", years=years)

    return set(h.keys())


# ---------------------------------------------------------------------------
# FRCP Rule 6(a)(1) Core Logic
# ---------------------------------------------------------------------------

def is_court_day(d: date, holiday_set: str = "federal") -> bool:
    """
    Returns True if the given date is a valid court day
    (not a Saturday, Sunday, or legal holiday).
    """
    if d.weekday() >= 5:  # 5 = Saturday, 6 = Sunday
        return False
    holidays_set = get_holiday_set(holiday_set, d.year)
    return d not in holidays_set


def next_court_day(d: date, holiday_set: str = "federal") -> date:
    """
    Roll a date forward to the next valid court day per FRCP Rule 6(a)(1).
    If the date is already a valid court day, returns it unchanged.
    """
    while not is_court_day(d, holiday_set):
        d += timedelta(days=1)
    return d


def prev_court_day(d: date, holiday_set: str = "federal") -> date:
    """
    Roll a date BACKWARD to the most recent valid court day.
    Used for "no later than" deadlines that fall on weekends/holidays.
    Note: Rule 6(a)(1) always rolls FORWARD, not backward.
    Only use this for non-Rule-6 "no later than" deadlines explicitly
    requiring backward roll in the applicable rule.
    """
    while not is_court_day(d, holiday_set):
        d -= timedelta(days=1)
    return d


def frcp_deadline(
    trigger: date,
    offset_days: int,
    direction: str = "after",
    roll_forward: bool = True,
    holiday_set: str = "federal",
) -> date:
    """
    Calculate a deadline per FRCP Rule 6(a)(1).

    Args:
        trigger:      The anchor/trigger date (day zero — not counted).
        offset_days:  Number of calendar days to add or subtract.
        direction:    "after" (deadline is N days AFTER trigger) or
                      "before" (deadline is N days BEFORE trigger).
        roll_forward: If True, apply Rule 6(a)(1) roll-forward past
                      weekends/holidays. Set False for "no earlier than"
                      or "no later than" deadlines that do not use Rule 6.
        holiday_set:  Which holiday calendar to use.

    Returns:
        The calculated deadline date.

    Example:
        # Rule 26(a)(1): initial disclosures 14 days after 26(f) conference
        frcp_deadline(date(2026, 4, 1), 14, "after", True) → date(2026, 4, 15)

        # Rule 26(a)(3): pretrial disclosures 30 days BEFORE trial
        frcp_deadline(date(2026, 9, 14), 30, "before", False) → date(2026, 8, 15)
    """
    if direction == "after":
        result = trigger + timedelta(days=offset_days)
    elif direction == "before":
        result = trigger - timedelta(days=offset_days)
    else:
        raise ValueError(f"direction must be 'after' or 'before', got: {direction!r}")

    if roll_forward:
        result = next_court_day(result, holiday_set)

    return result


# ---------------------------------------------------------------------------
# Reminder Dates
# ---------------------------------------------------------------------------

def calculate_reminder_dates(deadline_date: date, holiday_set: str = "federal") -> dict:
    """
    Calculate the 30-day, 4-day, and same-day reminder dates for a deadline.
    Reminders are rolled to valid court days so they appear on business days.

    Returns a dict:
        {
            "30_day": date,
            "4_day": date,
            "same_day": date,
        }
    """
    thirty_day = next_court_day(deadline_date - timedelta(days=30), holiday_set)
    four_day = next_court_day(deadline_date - timedelta(days=4), holiday_set)
    same_day = next_court_day(deadline_date, holiday_set)

    # If 30-day reminder is the same as the deadline (short deadlines),
    # don't create a confusing duplicate — set to deadline minus 1 court day
    if thirty_day >= deadline_date:
        thirty_day = prev_court_day(deadline_date - timedelta(days=1), holiday_set)
    if four_day >= deadline_date:
        four_day = prev_court_day(deadline_date - timedelta(days=1), holiday_set)

    return {
        "30_day": thirty_day,
        "4_day": four_day,
        "same_day": same_day,
    }


# ---------------------------------------------------------------------------
# Utility: Business Days Between Two Dates
# ---------------------------------------------------------------------------

def business_days_between(start: date, end: date, holiday_set: str = "federal") -> int:
    """
    Count the number of valid court days between two dates (exclusive of start,
    inclusive of end). Used for display purposes on the attorney sheet.
    """
    if end <= start:
        return 0
    holidays_set = get_holiday_set(holiday_set)
    count = 0
    current = start + timedelta(days=1)
    while current <= end:
        if current.weekday() < 5 and current not in holidays_set:
            count += 1
        current += timedelta(days=1)
    return count


def calendar_days_until(target: date, from_date: Optional[date] = None) -> int:
    """Days from today (or from_date) until target. Negative = past due."""
    from_date = from_date or date.today()
    return (target - from_date).days


# ---------------------------------------------------------------------------
# Mail Service Add-on (Rule 6(d))
# ---------------------------------------------------------------------------

def add_mail_service_days(deadline: date, served_by_mail: bool = False) -> date:
    """
    If the triggering document was served by mail (not electronically),
    Rule 6(d) adds 3 calendar days to the deadline.
    Electronic service adds 0 days (2016 amendment).
    """
    if served_by_mail:
        return deadline + timedelta(days=3)
    return deadline
