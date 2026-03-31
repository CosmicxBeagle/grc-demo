"""
Legal Daily Brief
─────────────────
Run this every morning to get your 30-day ahead work brief.

Usage:
  python run.py           → generate, save PDF, email it
  python run.py --preview → open the PDF after generating (no email)
  python run.py --login   → force a fresh Microsoft 365 login
  python run.py --logout  → clear saved login token

Scheduled (Windows Task Scheduler) — see setup.py for one-command setup.
"""

import sys
import argparse
import subprocess
from datetime import date, datetime
from pathlib import Path
from loguru import logger

# ── Configure logging ─────────────────────────────────────────────────────
logger.remove()
logger.add(sys.stdout, format="<green>{time:HH:mm:ss}</green> {level} {message}", level="INFO")
logger.add(
    Path(__file__).parent / "data" / "brief.log",
    rotation="1 week", retention="4 weeks",
    format="{time} {level} {message}", level="DEBUG",
    encoding="utf-8",
)


def main():
    parser = argparse.ArgumentParser(description="Legal Daily Brief Generator")
    parser.add_argument("--preview",  action="store_true", help="Open the PDF after generating")
    parser.add_argument("--login",    action="store_true", help="Force a fresh Microsoft 365 login")
    parser.add_argument("--logout",   action="store_true", help="Sign out and clear saved token")
    parser.add_argument("--no-email", action="store_true", help="Generate PDF but skip the email")
    parser.add_argument("--date",     type=str, default=None, help="Generate brief for a specific date (YYYY-MM-DD)")
    args = parser.parse_args()

    # ── Handle --logout ────────────────────────────────────────────────────
    if args.logout:
        from auth.graph_auth import sign_out
        sign_out()
        print("✓ Signed out. Run again to log in with a different account.")
        return

    # ── Validate config ────────────────────────────────────────────────────
    from config import cfg
    missing = cfg.validate()
    if missing:
        print(f"\n❌  Missing required settings in .env: {', '.join(missing)}")
        print(f"    Copy .env.example → .env and fill in the values.\n")
        sys.exit(1)

    # ── Force re-login if requested ────────────────────────────────────────
    if args.login:
        from auth.token_cache import clear_cache
        clear_cache()
        logger.info("Token cache cleared — will prompt for login.")

    # ── Authenticate ───────────────────────────────────────────────────────
    logger.info("Authenticating with Microsoft 365...")
    try:
        from auth.graph_auth import get_token
        token = get_token()   # Prompts device-code login only if needed
    except Exception as e:
        logger.error(f"Authentication failed: {e}")
        sys.exit(1)

    # ── Fetch calendar events ──────────────────────────────────────────────
    logger.info(f"Fetching calendar — next {cfg.lookahead_days} days...")
    try:
        from calendar.reader import fetch_events
        deadlines, others = fetch_events(
            token=token,
            lookahead_days=cfg.lookahead_days,
            deadline_prefix=cfg.deadline_prefix,
            calendar_name=cfg.outlook_calendar_name,
        )
    except Exception as e:
        logger.error(f"Calendar fetch failed: {e}")
        sys.exit(1)

    # ── Build report data ──────────────────────────────────────────────────
    from report.builder import build
    report_date = date.today()
    if args.date:
        try:
            report_date = date.fromisoformat(args.date)
        except ValueError:
            logger.error(f"Invalid date format: {args.date}. Use YYYY-MM-DD.")
            sys.exit(1)

    brief = build(deadlines, others, report_date)

    # Log a quick summary
    logger.info(
        f"Brief for {brief.report_date_str}: "
        f"{len(brief.overdue)} overdue, "
        f"{len(brief.due_today)} today, "
        f"{len(brief.due_soon)} in 1-4 days, "
        f"{sum(len(g.events) for g in brief.due_30)} in 5-30 days"
    )

    # ── Generate PDF ───────────────────────────────────────────────────────
    logger.info("Generating PDF...")
    from report.pdf import render
    pdf_path = render(
        brief=brief,
        save_dir=cfg.report_save_path,
        firm_name=cfg.firm_name,
        your_name=cfg.your_name,
        lookahead_days=cfg.lookahead_days,
    )
    logger.info(f"Saved → {pdf_path}")

    # ── Email ──────────────────────────────────────────────────────────────
    if not args.no_email and cfg.your_email:
        logger.info(f"Emailing brief to {cfg.your_email}...")
        from report.emailer import send
        send(pdf_path, cfg.your_email, report_date, cfg.firm_name)
    elif args.no_email:
        logger.info("Skipping email (--no-email flag).")
    else:
        logger.warning("YOUR_EMAIL not set — skipping email.")

    # ── Preview (open the file) ────────────────────────────────────────────
    if args.preview:
        logger.info("Opening PDF...")
        if sys.platform == "darwin":
            subprocess.run(["open", str(pdf_path)])
        elif sys.platform == "win32":
            os.startfile(str(pdf_path))
        else:
            subprocess.run(["xdg-open", str(pdf_path)])

    logger.info("Done ✓")


if __name__ == "__main__":
    main()
