"""
Deadline Calculation Engine
Loads jurisdiction YAML rules and calculates all deadlines from trigger dates.

Usage:
    engine = DeadlineEngine(jurisdiction="nd_okla")
    deadlines = engine.calculate_all(trigger_dates, scheduling_order_dates)
"""

import json
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml
from loguru import logger

from core.date_utils import frcp_deadline, calculate_reminder_dates, calendar_days_until


# ---------------------------------------------------------------------------
# Data Classes
# ---------------------------------------------------------------------------

@dataclass
class CalculatedDeadline:
    """Result of a single deadline calculation."""
    rule_key: str
    rule_source: str              # e.g., "frcp", "nd_okla", "scheduling_order"
    label: str
    description: str
    deadline_date: date
    source: str                   # "rule_derived" | "scheduling_order" | "manual"
    is_critical: bool
    display_order: int
    citation: str
    trigger_key: str
    trigger_date: date
    offset_days: int
    direction: str
    calculation_basis: dict       # Audit trail
    has_conflict: bool = False
    conflict_note: str = ""
    reminders: dict = field(default_factory=dict)   # {30_day, 4_day, same_day}
    days_until: int = 0

    def to_dict(self) -> dict:
        return {
            "rule_key": self.rule_key,
            "rule_source": self.rule_source,
            "label": self.label,
            "description": self.description,
            "deadline_date": self.deadline_date.isoformat(),
            "source": self.source,
            "is_critical": self.is_critical,
            "display_order": self.display_order,
            "citation": self.citation,
            "trigger_key": self.trigger_key,
            "trigger_date": self.trigger_date.isoformat(),
            "has_conflict": self.has_conflict,
            "conflict_note": self.conflict_note,
            "days_until": self.days_until,
            "calculation_basis": self.calculation_basis,
            "reminders": {
                k: v.isoformat() for k, v in self.reminders.items()
            },
        }


# ---------------------------------------------------------------------------
# Rule Loader
# ---------------------------------------------------------------------------

RULES_DIR = Path(__file__).parent.parent / "rules"

# Rule files to load for each jurisdiction (ordered: FRCP first, then local)
JURISDICTION_RULE_FILES = {
    "nd_okla": ["frcp.yaml", "nd_okla.yaml"],
    "ed_okla": ["frcp.yaml", "ed_okla.yaml"],
    "wd_ark": ["frcp.yaml", "wd_ark.yaml"],
    "tulsa_county": ["tulsa_county.yaml"],
    "creek_county": ["creek_county.yaml"],
}


def load_rules(jurisdiction: str) -> Tuple[List[dict], str]:
    """
    Load all applicable rule definitions for a jurisdiction.
    Returns (rules_list, holiday_set).
    Local rules come last so they can override FRCP defaults.
    """
    rule_files = JURISDICTION_RULE_FILES.get(jurisdiction, ["frcp.yaml"])
    all_rules = []
    holiday_set = "federal"

    for filename in rule_files:
        path = RULES_DIR / filename
        if not path.exists():
            logger.warning(f"Rule file not found: {path}")
            continue
        with open(path, "r") as f:
            data = yaml.safe_load(f)
        rules = data.get("rules", [])
        # Use the most specific jurisdiction's holiday set
        if data.get("holiday_set"):
            holiday_set = data["holiday_set"]
        all_rules.extend(rules)
        logger.debug(f"Loaded {len(rules)} rules from {filename}")

    return all_rules, holiday_set


# ---------------------------------------------------------------------------
# Deadline Engine
# ---------------------------------------------------------------------------

class DeadlineEngine:
    """
    Calculates all deadlines for a case given:
      - trigger_dates: dict of {trigger_key: date} from the scheduling order
      - scheduling_order_dates: dict of {rule_key: date} for explicitly stated
        dates that override rule-derived calculations
    """

    def __init__(self, jurisdiction: str):
        self.jurisdiction = jurisdiction
        self.rules, self.holiday_set = load_rules(jurisdiction)
        logger.info(
            f"DeadlineEngine initialized: jurisdiction={jurisdiction}, "
            f"{len(self.rules)} rules, holiday_set={self.holiday_set}"
        )

    def calculate_all(
        self,
        trigger_dates: Dict[str, date],
        scheduling_order_dates: Optional[Dict[str, date]] = None,
    ) -> List[CalculatedDeadline]:
        """
        Calculate all applicable deadlines for a case.

        Args:
            trigger_dates: e.g., {"trial_date": date(2027,1,12), "discovery_cutoff_date": date(2026,10,14)}
            scheduling_order_dates: e.g., {"nd_okla_plaintiff_expert_default": date(2026,7,1)}
                If a rule_key appears here, use this explicit date instead of calculating it.

        Returns:
            List of CalculatedDeadline objects, sorted by deadline_date.
        """
        scheduling_order_dates = scheduling_order_dates or {}
        deadlines: List[CalculatedDeadline] = []

        for rule in self.rules:
            rule_key = rule["key"]
            trigger_key = rule["trigger_key"]

            # Check if trigger date is available
            if trigger_key not in trigger_dates:
                logger.debug(f"Skipping rule {rule_key}: trigger '{trigger_key}' not provided")
                continue

            trigger_date = trigger_dates[trigger_key]
            offset_days = rule["offset_days"]
            direction = rule.get("direction", "after")
            roll_forward = rule.get("roll_forward", True)

            # Check if the scheduling order explicitly provides this deadline
            if rule_key in scheduling_order_dates:
                order_date = scheduling_order_dates[rule_key]
                # Calculate what the rule would derive, for conflict detection
                rule_derived_date = frcp_deadline(
                    trigger_date, offset_days, direction, roll_forward, self.holiday_set
                )
                has_conflict = (order_date != rule_derived_date)
                conflict_note = (
                    f"Scheduling order: {order_date.isoformat()}; "
                    f"Rule-derived: {rule_derived_date.isoformat()}"
                    if has_conflict else ""
                )
                deadline_date = order_date   # Scheduling order controls
                source = "scheduling_order"
                logger.debug(
                    f"{rule_key}: using scheduling order date {order_date} "
                    f"(rule derived: {rule_derived_date}, conflict: {has_conflict})"
                )
            else:
                # Calculate from rule
                deadline_date = frcp_deadline(
                    trigger_date, offset_days, direction, roll_forward, self.holiday_set
                )
                has_conflict = False
                conflict_note = ""
                source = "rule_derived"
                logger.debug(f"{rule_key}: calculated {deadline_date} from {trigger_key}={trigger_date}")

            # Calculate reminders
            reminders = calculate_reminder_dates(deadline_date, self.holiday_set)

            # Audit trail
            calculation_basis = {
                "trigger_key": trigger_key,
                "trigger_date": trigger_date.isoformat(),
                "offset_days": offset_days,
                "direction": direction,
                "roll_forward": roll_forward,
                "holiday_set": self.holiday_set,
                "source": source,
            }

            dl = CalculatedDeadline(
                rule_key=rule_key,
                rule_source=self._get_rule_source(rule_key),
                label=rule["label"],
                description=rule.get("description", "").strip(),
                deadline_date=deadline_date,
                source=source,
                is_critical=rule.get("is_critical", False),
                display_order=rule.get("display_order", 100),
                citation=rule.get("citation", ""),
                trigger_key=trigger_key,
                trigger_date=trigger_date,
                offset_days=offset_days,
                direction=direction,
                calculation_basis=calculation_basis,
                has_conflict=has_conflict,
                conflict_note=conflict_note,
                reminders=reminders,
                days_until=calendar_days_until(deadline_date),
            )
            deadlines.append(dl)

        # Sort by deadline date, then display_order
        deadlines.sort(key=lambda d: (d.deadline_date, d.display_order))
        logger.info(f"Calculated {len(deadlines)} deadlines for jurisdiction={self.jurisdiction}")
        return deadlines

    def _get_rule_source(self, rule_key: str) -> str:
        """Infer the rule source from the key prefix."""
        if rule_key.startswith("frcp_"):
            return "frcp"
        elif rule_key.startswith("nd_okla_"):
            return "nd_okla"
        elif rule_key.startswith("ed_okla_"):
            return "ed_okla"
        elif rule_key.startswith("wd_ark_"):
            return "wd_ark"
        elif rule_key.startswith("tulsa_"):
            return "tulsa_county"
        elif rule_key.startswith("creek_"):
            return "creek_county"
        return "unknown"

    def get_thirty_day_horizon(
        self,
        deadlines: List[CalculatedDeadline],
        from_date: Optional[date] = None,
    ) -> Dict[str, List[CalculatedDeadline]]:
        """
        Filter deadlines to the 30-day window and organize by date bucket.
        This drives the main "30-Day View" and the attorney sheet.

        Returns:
            {
                "due_today": [...],
                "due_this_week": {...grouped by date...},
                "due_next_30_days": [...],
                "reminders_30_day_today": [...],   # 30-day warnings triggering today
                "reminders_4_day_today": [...],    # 4-day warnings triggering today
                "overdue": [...],
            }
        """
        from_date = from_date or date.today()
        thirty_out = from_date + __import__("datetime").timedelta(days=30)

        result = {
            "due_today": [],
            "due_this_week": {},
            "due_next_30_days": [],
            "reminders_30_day_today": [],
            "reminders_4_day_today": [],
            "overdue": [],
        }

        for dl in deadlines:
            days = calendar_days_until(dl.deadline_date, from_date)

            if days < 0:
                result["overdue"].append(dl)
            elif days == 0:
                result["due_today"].append(dl)
            elif 1 <= days <= 7:
                day_key = dl.deadline_date.isoformat()
                result["due_this_week"].setdefault(day_key, []).append(dl)
            elif days <= 30:
                result["due_next_30_days"].append(dl)

            # Check reminders
            if dl.reminders.get("30_day") == from_date:
                result["reminders_30_day_today"].append(dl)
            if dl.reminders.get("4_day") == from_date:
                result["reminders_4_day_today"].append(dl)

        return result

    def detect_conflicts(
        self,
        deadlines: List[CalculatedDeadline],
    ) -> List[CalculatedDeadline]:
        """Return only deadlines that have a conflict between rule and order."""
        return [d for d in deadlines if d.has_conflict]
