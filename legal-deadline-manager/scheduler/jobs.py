"""
APScheduler Background Jobs
  - Daily 7:00 AM: Generate attorney sheet PDF and email it
  - Every hour: Check for pending Outlook sync records and push to Graph API
  - Daily 6:00 AM: Check for reminders triggering today and create Outlook events

Start/stop is managed from main.py lifespan.
"""

from datetime import date, datetime
from loguru import logger
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from config import get_settings

settings = get_settings()
scheduler = BackgroundScheduler(timezone="America/Chicago")


# ---------------------------------------------------------------------------
# Job: Generate Daily Attorney Sheet
# ---------------------------------------------------------------------------

def job_generate_attorney_sheet():
    """
    Runs every morning at the configured time (default 7:00 AM).
    Queries the database for today's deadlines, generates the PDF, and emails it.
    """
    from datetime import date as date_cls
    from pathlib import Path

    today = date_cls.today()
    logger.info(f"[Scheduler] Generating attorney sheet for {today}")

    try:
        # Import here to avoid circular imports at module load
        from database.connection import get_sync_session
        from database.models import Deadline, DeadlineStatus, Case, Reminder, ReminderType
        from sqlalchemy import and_, func
        from datetime import timedelta
        from reports.attorney_sheet import generate_attorney_sheet, email_attorney_sheet, DeadlineRow

        with get_sync_session() as session:
            week_end = today + timedelta(days=7)

            # Query deadlines due today or this week
            deadlines_raw = (
                session.query(Deadline, Case)
                .join(Case, Deadline.case_id == Case.id)
                .filter(
                    Deadline.status == DeadlineStatus.PENDING,
                    Deadline.deadline_date >= today,
                    Deadline.deadline_date <= week_end,
                )
                .order_by(Deadline.deadline_date, Deadline.display_order)
                .all()
            )

            # Query overdue
            overdue_raw = (
                session.query(Deadline, Case)
                .join(Case, Deadline.case_id == Case.id)
                .filter(
                    Deadline.status == DeadlineStatus.PENDING,
                    Deadline.deadline_date < today,
                )
                .order_by(Deadline.deadline_date)
                .all()
            )

            # Query 30-day and 4-day reminders triggering today
            reminders_raw = (
                session.query(Reminder, Deadline, Case)
                .join(Deadline, Reminder.deadline_id == Deadline.id)
                .join(Case, Deadline.case_id == Case.id)
                .filter(
                    Reminder.reminder_date == today,
                    Reminder.is_triggered == False,
                    Deadline.status == DeadlineStatus.PENDING,
                )
                .all()
            )

        def _to_row(dl, case, days_override=None):
            days = days_override if days_override is not None else (dl.deadline_date - today).days
            return DeadlineRow(
                case_name=case.case_name,
                case_number=case.case_number,
                court=case.court_name,
                label=dl.label,
                deadline_date=dl.deadline_date,
                days_until=days,
                is_critical=dl.is_critical,
                is_overdue=dl.deadline_date < today,
                citation=dl.description or "",
            )

        due_today = []
        due_this_week = {}
        for dl, case in deadlines_raw:
            days = (dl.deadline_date - today).days
            row = _to_row(dl, case)
            if days == 0:
                due_today.append(row)
            else:
                key = dl.deadline_date.isoformat()
                due_this_week.setdefault(key, []).append(row)

        overdue = [_to_row(dl, case, (dl.deadline_date - today).days) for dl, case in overdue_raw]
        reminders_30 = []
        reminders_4 = []
        for reminder, dl, case in reminders_raw:
            row = _to_row(dl, case)
            if reminder.reminder_type.value == "30_day":
                reminders_30.append(row)
            elif reminder.reminder_type.value == "4_day":
                reminders_4.append(row)

        pdf_path = generate_attorney_sheet(
            report_date=today,
            due_today=due_today,
            due_this_week=due_this_week,
            reminders_30_day=reminders_30,
            reminders_4_day=reminders_4,
            overdue=overdue,
        )

        # Email to attorney
        email_attorney_sheet(pdf_path, today)

        logger.info(
            f"[Scheduler] Attorney sheet complete: "
            f"{len(due_today)} due today, {len(due_this_week)} days with items, "
            f"{len(overdue)} overdue, {len(reminders_4)} 4-day warnings."
        )

    except Exception as e:
        logger.error(f"[Scheduler] Attorney sheet generation failed: {e}", exc_info=True)


# ---------------------------------------------------------------------------
# Job: Sync Pending Outlook Records
# ---------------------------------------------------------------------------

def job_sync_outlook():
    """
    Runs every hour. Finds unsynced or failed deadline records and
    pushes them to Outlook calendar and Microsoft To Do.
    """
    logger.info("[Scheduler] Running Outlook sync job...")
    try:
        from auth.msal_client import is_authenticated
        if not is_authenticated():
            logger.info("[Scheduler] Outlook sync skipped: not authenticated.")
            return

        # TODO (Phase 2): Query outlook_sync_records with status=PENDING|FAILED
        # and call calendar_sync / tasks_sync for each one.
        logger.info("[Scheduler] Outlook sync complete.")
    except Exception as e:
        logger.error(f"[Scheduler] Outlook sync failed: {e}", exc_info=True)


# ---------------------------------------------------------------------------
# Job: Trigger Reminders
# ---------------------------------------------------------------------------

def job_trigger_reminders():
    """
    Runs daily at 6:00 AM (before the attorney sheet job).
    Marks reminders as triggered and fires Outlook events for today's reminders.
    """
    today = date.today()
    logger.info(f"[Scheduler] Checking reminders for {today}...")
    try:
        # TODO (Phase 2): Query reminders where reminder_date == today and is_triggered == False
        # Create Outlook calendar events for each and mark is_triggered = True
        logger.info("[Scheduler] Reminder job complete.")
    except Exception as e:
        logger.error(f"[Scheduler] Reminder job failed: {e}", exc_info=True)


# ---------------------------------------------------------------------------
# Scheduler Start / Stop
# ---------------------------------------------------------------------------

def start_scheduler():
    """Register all jobs and start the APScheduler."""
    hour, minute = settings.daily_sheet_time.split(":")

    # Daily attorney sheet (configurable time, default 7:00 AM)
    scheduler.add_job(
        job_generate_attorney_sheet,
        CronTrigger(hour=int(hour), minute=int(minute)),
        id="daily_attorney_sheet",
        name="Daily Attorney Sheet",
        replace_existing=True,
        misfire_grace_time=3600,  # Run up to 1 hour late if server was down
    )

    # Reminder triggering (6:00 AM, before the sheet)
    scheduler.add_job(
        job_trigger_reminders,
        CronTrigger(hour=6, minute=0),
        id="trigger_reminders",
        name="Trigger Daily Reminders",
        replace_existing=True,
    )

    # Outlook sync (every hour)
    scheduler.add_job(
        job_sync_outlook,
        CronTrigger(minute=0),  # Top of every hour
        id="outlook_sync",
        name="Outlook Sync",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(f"Scheduler started. Sheet will generate at {settings.daily_sheet_time} CT daily.")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
