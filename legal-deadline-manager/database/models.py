"""
SQLAlchemy ORM Models — Legal Deadline Manager
All tables for cases, scheduling orders, deadlines, reminders, and sync tracking.
"""

from datetime import datetime, date
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, Text, Date, DateTime, Boolean,
    ForeignKey, Enum, UniqueConstraint, Index, Float
)
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# ENUMS
# ---------------------------------------------------------------------------

class CaseStatus(str, PyEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    CLOSED = "closed"
    SETTLED = "settled"


class CaseType(str, PyEnum):
    INSURANCE_BAD_FAITH = "insurance_bad_faith"
    CANNABIS_REGULATORY = "cannabis_regulatory"
    CIVIL_LITIGATION = "civil_litigation"
    FAMILY_LAW = "family_law"
    CONSUMER_PROTECTION = "consumer_protection"
    OTHER = "other"


class CourtType(str, PyEnum):
    FEDERAL = "federal"
    STATE = "state"


class Jurisdiction(str, PyEnum):
    ND_OKLA = "nd_okla"         # Northern District of Oklahoma
    ED_OKLA = "ed_okla"         # Eastern District of Oklahoma
    WD_ARK = "wd_ark"           # Western District of Arkansas
    TULSA_COUNTY = "tulsa_county"
    CREEK_COUNTY = "creek_county"
    OTHER_FEDERAL = "other_federal"
    OTHER_STATE = "other_state"


class DeadlineSource(str, PyEnum):
    RULE_DERIVED = "rule_derived"       # Calculated from FRCP/local rules
    SCHEDULING_ORDER = "scheduling_order"  # Explicitly stated in scheduling order
    MANUAL = "manual"                   # Manually entered by paralegal


class DeadlineStatus(str, PyEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    MISSED = "missed"
    EXTENDED = "extended"
    WAIVED = "waived"


class ReminderType(str, PyEnum):
    THIRTY_DAY = "30_day"
    FOUR_DAY = "4_day"
    SAME_DAY = "same_day"


class SyncTarget(str, PyEnum):
    OUTLOOK_CALENDAR = "outlook_calendar"
    OUTLOOK_TASKS = "outlook_tasks"


class SyncStatus(str, PyEnum):
    PENDING = "pending"
    SYNCED = "synced"
    FAILED = "failed"
    DELETED = "deleted"


# ---------------------------------------------------------------------------
# CASES
# ---------------------------------------------------------------------------

class Case(Base):
    """
    Core case record. One case can have multiple scheduling orders.
    """
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_name = Column(String(255), nullable=False)
    case_number = Column(String(100), nullable=False)
    court_name = Column(String(255), nullable=False)          # e.g., "U.S. District Court, N.D. Okla."
    jurisdiction = Column(Enum(Jurisdiction), nullable=False)
    court_type = Column(Enum(CourtType), nullable=False)
    case_type = Column(Enum(CaseType), nullable=False, default=CaseType.CIVIL_LITIGATION)
    status = Column(Enum(CaseStatus), nullable=False, default=CaseStatus.ACTIVE)

    # Client and attorney info
    client_name = Column(String(255), nullable=True)
    assigned_attorney = Column(String(255), nullable=True)
    assigned_paralegal = Column(String(255), nullable=True)

    # Needles/Neos integration (Phase 3)
    needles_case_id = Column(String(100), nullable=True, unique=True)

    # Notes
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    scheduling_orders = relationship("SchedulingOrder", back_populates="case", cascade="all, delete-orphan")
    deadlines = relationship("Deadline", back_populates="case", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("case_number", "jurisdiction", name="uq_case_number_jurisdiction"),
        Index("ix_cases_status", "status"),
        Index("ix_cases_jurisdiction", "jurisdiction"),
    )

    def __repr__(self):
        return f"<Case {self.case_number} — {self.case_name}>"


# ---------------------------------------------------------------------------
# SCHEDULING ORDERS
# ---------------------------------------------------------------------------

class SchedulingOrder(Base):
    """
    A scheduling order document associated with a case.
    One case may have an original order + one or more amended orders.
    """
    __tablename__ = "scheduling_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)

    title = Column(String(255), nullable=False, default="Scheduling Order")   # e.g., "Amended Scheduling Order"
    order_date = Column(Date, nullable=True)                                   # Date the order was entered
    order_number = Column(String(50), nullable=True)                           # Docket entry number
    is_active = Column(Boolean, nullable=False, default=True)                  # Only one active order per case

    # Raw document storage
    original_filename = Column(String(500), nullable=True)
    file_path = Column(String(1000), nullable=True)   # Path to stored PDF/DOCX
    raw_text = Column(Text, nullable=True)             # Extracted text

    # Parsing metadata
    parsed_at = Column(DateTime, nullable=True)
    parse_confidence = Column(Float, nullable=True)    # 0.0–1.0 confidence score
    needs_review = Column(Boolean, nullable=False, default=True)  # Paralegal must confirm

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="scheduling_orders")
    trigger_dates = relationship("TriggerDate", back_populates="scheduling_order", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SchedulingOrder case_id={self.case_id} title={self.title}>"


class TriggerDate(Base):
    """
    Key anchor dates extracted from a scheduling order.
    Each trigger date can drive multiple calculated deadlines.
    """
    __tablename__ = "trigger_dates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scheduling_order_id = Column(Integer, ForeignKey("scheduling_orders.id"), nullable=False)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)

    # The type of trigger date — maps to rule definitions in YAML
    trigger_key = Column(String(100), nullable=False)       # e.g., "trial_date", "discovery_cutoff"
    label = Column(String(255), nullable=False)             # Human-readable: "Trial Date"
    trigger_date = Column(Date, nullable=False)

    # Source of this date
    source = Column(Enum(DeadlineSource), nullable=False, default=DeadlineSource.SCHEDULING_ORDER)
    is_confirmed = Column(Boolean, nullable=False, default=False)  # Paralegal confirmed this date

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    scheduling_order = relationship("SchedulingOrder", back_populates="trigger_dates")
    derived_deadlines = relationship("Deadline", back_populates="trigger_date")

    __table_args__ = (
        UniqueConstraint("scheduling_order_id", "trigger_key", name="uq_order_trigger_key"),
        Index("ix_trigger_dates_case", "case_id"),
    )

    def __repr__(self):
        return f"<TriggerDate {self.trigger_key}={self.trigger_date}>"


# ---------------------------------------------------------------------------
# DEADLINES
# ---------------------------------------------------------------------------

class Deadline(Base):
    """
    A single deadline — either derived from rules or taken directly
    from a scheduling order.  Each deadline gets up to 3 reminders.
    """
    __tablename__ = "deadlines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    trigger_date_id = Column(Integer, ForeignKey("trigger_dates.id"), nullable=True)  # null if manually entered

    # Deadline identification
    rule_key = Column(String(100), nullable=True)            # e.g., "frcp_26a1_initial_disclosures"
    rule_source = Column(String(100), nullable=True)         # e.g., "frcp", "nd_okla", "scheduling_order"
    label = Column(String(500), nullable=False)              # "Plaintiff Expert Disclosures Due"
    description = Column(Text, nullable=True)                # Full description / citation

    # The deadline
    deadline_date = Column(Date, nullable=False)
    source = Column(Enum(DeadlineSource), nullable=False)
    status = Column(Enum(DeadlineStatus), nullable=False, default=DeadlineStatus.PENDING)

    # Conflict detection
    has_conflict = Column(Boolean, nullable=False, default=False)
    conflict_note = Column(Text, nullable=True)  # e.g., "Scheduling order says 2026-05-01; FRCP rule derives 2026-04-28"

    # Calculation audit trail
    calculation_basis = Column(Text, nullable=True)  # JSON: {"trigger_key": "trial_date", "offset_days": -90, "roll_forward": true}

    # Display / priority
    is_critical = Column(Boolean, nullable=False, default=False)   # Flag for high-priority deadlines
    display_order = Column(Integer, nullable=False, default=100)    # Sort order on attorney sheet

    # Completion tracking
    completed_at = Column(DateTime, nullable=True)
    completed_by = Column(String(100), nullable=True)
    completion_notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="deadlines")
    trigger_date = relationship("TriggerDate", back_populates="derived_deadlines")
    reminders = relationship("Reminder", back_populates="deadline", cascade="all, delete-orphan")
    sync_records = relationship("OutlookSyncRecord", back_populates="deadline", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_deadlines_case_date", "case_id", "deadline_date"),
        Index("ix_deadlines_date_status", "deadline_date", "status"),
        Index("ix_deadlines_status", "status"),
    )

    def __repr__(self):
        return f"<Deadline case_id={self.case_id} date={self.deadline_date} label={self.label[:40]}>"


# ---------------------------------------------------------------------------
# REMINDERS
# ---------------------------------------------------------------------------

class Reminder(Base):
    """
    A reminder associated with a deadline.
    Each deadline gets a 30-day, 4-day, and same-day reminder.
    """
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    deadline_id = Column(Integer, ForeignKey("deadlines.id"), nullable=False)

    reminder_type = Column(Enum(ReminderType), nullable=False)
    reminder_date = Column(Date, nullable=False)           # The date this reminder triggers
    label = Column(String(500), nullable=False)            # "30-Day Warning: Expert Disclosures"

    is_triggered = Column(Boolean, nullable=False, default=False)
    triggered_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    deadline = relationship("Deadline", back_populates="reminders")
    sync_records = relationship("OutlookSyncRecord", back_populates="reminder", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("deadline_id", "reminder_type", name="uq_deadline_reminder_type"),
        Index("ix_reminders_date", "reminder_date"),
        Index("ix_reminders_triggered", "is_triggered", "reminder_date"),
    )

    def __repr__(self):
        return f"<Reminder {self.reminder_type} on {self.reminder_date} for deadline_id={self.deadline_id}>"


# ---------------------------------------------------------------------------
# OUTLOOK SYNC TRACKING
# ---------------------------------------------------------------------------

class OutlookSyncRecord(Base):
    """
    Tracks what has been pushed to Microsoft Outlook (calendar events + tasks).
    Enables idempotent sync — prevents duplicate events on retry.
    """
    __tablename__ = "outlook_sync_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    deadline_id = Column(Integer, ForeignKey("deadlines.id"), nullable=True)
    reminder_id = Column(Integer, ForeignKey("reminders.id"), nullable=True)

    sync_target = Column(Enum(SyncTarget), nullable=False)
    sync_status = Column(Enum(SyncStatus), nullable=False, default=SyncStatus.PENDING)

    # Microsoft Graph resource IDs (stored for update/delete)
    graph_event_id = Column(String(500), nullable=True)          # Outlook calendar event ID
    graph_task_id = Column(String(500), nullable=True)           # To Do task ID
    graph_task_list_id = Column(String(500), nullable=True)      # To Do task list ID
    transaction_id = Column(String(100), nullable=True, unique=True)  # UUID for idempotency

    # Sync metadata
    synced_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    deadline = relationship("Deadline", back_populates="sync_records")
    reminder = relationship("Reminder", back_populates="sync_records")

    __table_args__ = (
        Index("ix_sync_status", "sync_status"),
        Index("ix_sync_deadline", "deadline_id"),
    )


# ---------------------------------------------------------------------------
# DAILY REPORT LOG
# ---------------------------------------------------------------------------

class DailyReport(Base):
    """
    Log of generated attorney daily sheets (PDFs).
    """
    __tablename__ = "daily_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_date = Column(Date, nullable=False, unique=True)
    file_path = Column(String(1000), nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    deadline_count = Column(Integer, nullable=False, default=0)
    reminder_count = Column(Integer, nullable=False, default=0)
    emailed = Column(Boolean, nullable=False, default=False)
    emailed_to = Column(String(255), nullable=True)
    email_sent_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<DailyReport date={self.report_date} path={self.file_path}>"


# ---------------------------------------------------------------------------
# APP SETTINGS
# ---------------------------------------------------------------------------

class AppSetting(Base):
    """
    Key-value store for application settings (firm name, email addresses,
    Graph API configuration, etc.). Values for secrets are stored as references
    to environment variables, not the secrets themselves.
    """
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), nullable=False, unique=True)
    value = Column(Text, nullable=True)
    description = Column(String(500), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<AppSetting {self.key}>"
