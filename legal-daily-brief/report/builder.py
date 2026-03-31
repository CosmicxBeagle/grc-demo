"""
Report Builder
Takes the raw calendar events and organises them into the sections
that appear on the daily brief.

Deadline sections (DD: events):
  overdue        days_until < 0
  due_today      days_until == 0
  due_soon       1 <= days_until <= 4   (4-day window)
  due_30         5 <= days_until <= 30  (grouped by date)

Other-events sections (everything else, same windows):
  other_today    days_until == 0
  other_soon     1 <= days_until <= 4
  other_30       5 <= days_until <= 30  (grouped by date)
"""

from dataclasses import dataclass, field
from datetime import date
from collections import defaultdict
from calendar.reader import CalendarEvent


@dataclass
class DayGroup:
    """A cluster of events on the same date, used in the 5-30 day sections."""
    date: date
    date_str: str     # "Monday, April 14"
    events: list[CalendarEvent] = field(default_factory=list)


@dataclass
class Brief:
    report_date: date
    report_date_str: str

    # DD: deadline buckets
    overdue:    list[CalendarEvent] = field(default_factory=list)
    due_today:  list[CalendarEvent] = field(default_factory=list)
    due_soon:   list[CalendarEvent] = field(default_factory=list)   # 1-4 days
    due_30:     list[DayGroup]      = field(default_factory=list)   # 5-30, by day

    # Everything-else buckets
    other_today: list[CalendarEvent] = field(default_factory=list)
    other_soon:  list[CalendarEvent] = field(default_factory=list)
    other_30:    list[DayGroup]      = field(default_factory=list)

    @property
    def has_anything(self) -> bool:
        return any([
            self.overdue, self.due_today, self.due_soon, self.due_30,
            self.other_today, self.other_soon, self.other_30,
        ])

    @property
    def total_deadlines(self) -> int:
        return (len(self.overdue) + len(self.due_today) +
                len(self.due_soon) + sum(len(g.events) for g in self.due_30))


def _day_label(d: date) -> str:
    today = date.today()
    delta = (d - today).days
    if delta == 1:
        return f"Tomorrow — {d.strftime('%A, %B %-d')}" if hasattr(date, 'strftime') else d.strftime("Tomorrow — %A, %B %d")
    return d.strftime("%A, %B %d")


def _group_by_date(events: list[CalendarEvent]) -> list[DayGroup]:
    buckets: dict[date, list[CalendarEvent]] = defaultdict(list)
    for ev in events:
        buckets[ev.start].append(ev)
    return [
        DayGroup(date=d, date_str=_day_label(d), events=evs)
        for d, evs in sorted(buckets.items())
    ]


def build(
    deadlines: list[CalendarEvent],
    others: list[CalendarEvent],
    report_date: date | None = None,
) -> Brief:
    report_date = report_date or date.today()

    brief = Brief(
        report_date=report_date,
        report_date_str=report_date.strftime("%A, %B %d, %Y"),
    )

    dl_soon, dl_30 = [], []
    ot_soon, ot_30 = [], []

    for ev in deadlines:
        d = ev.days_until
        if d < 0:
            brief.overdue.append(ev)
        elif d == 0:
            brief.due_today.append(ev)
        elif d <= 4:
            dl_soon.append(ev)
        else:
            dl_30.append(ev)

    for ev in others:
        d = ev.days_until
        if d == 0:
            brief.other_today.append(ev)
        elif d <= 4:
            ot_soon.append(ev)
        else:
            ot_30.append(ev)

    brief.due_soon  = dl_soon
    brief.other_soon = ot_soon
    brief.due_30    = _group_by_date(dl_30)
    brief.other_30  = _group_by_date(ot_30)

    return brief
