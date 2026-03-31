"""
One-command scheduled task setup — works on both Mac and Windows.

  python setup_schedule.py          → register the daily brief task
  python setup_schedule.py --remove → unregister it
  python setup_schedule.py --status → show whether the task is registered

Mac:   creates a launchd plist at ~/Library/LaunchAgents/
       (launchd is the Mac equivalent of Windows Task Scheduler)
Windows: creates a Windows Task Scheduler entry via schtasks
"""

import sys
import os
import subprocess
import argparse
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SEND_TIME  = os.getenv("SEND_TIME", "07:00")
TASK_NAME  = "com.legaldailybrief"          # used on both platforms
PLIST_PATH = Path.home() / "Library" / "LaunchAgents" / f"{TASK_NAME}.plist"


# ── Helpers ────────────────────────────────────────────────────────────────

def python_exe() -> str:
    return sys.executable

def run_script() -> str:
    return str(Path(__file__).parent / "run.py")

def work_dir() -> str:
    return str(Path(__file__).parent)

def parse_time(t: str) -> tuple[int, int]:
    h, m = t.split(":")
    return int(h), int(m)


# ── macOS launchd ──────────────────────────────────────────────────────────

MAC_PLIST_TEMPLATE = """\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{label}</string>

    <key>ProgramArguments</key>
    <array>
        <string>{python}</string>
        <string>{script}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>{workdir}</string>

    <!-- Run Mon–Fri at the configured time -->
    <key>StartCalendarInterval</key>
    <array>
        <dict>
            <key>Weekday</key><integer>1</integer>
            <key>Hour</key><integer>{hour}</integer>
            <key>Minute</key><integer>{minute}</integer>
        </dict>
        <dict>
            <key>Weekday</key><integer>2</integer>
            <key>Hour</key><integer>{hour}</integer>
            <key>Minute</key><integer>{minute}</integer>
        </dict>
        <dict>
            <key>Weekday</key><integer>3</integer>
            <key>Hour</key><integer>{hour}</integer>
            <key>Minute</key><integer>{minute}</integer>
        </dict>
        <dict>
            <key>Weekday</key><integer>4</integer>
            <key>Hour</key><integer>{hour}</integer>
            <key>Minute</key><integer>{minute}</integer>
        </dict>
        <dict>
            <key>Weekday</key><integer>5</integer>
            <key>Hour</key><integer>{hour}</integer>
            <key>Minute</key><integer>{minute}</integer>
        </dict>
    </array>

    <key>StandardOutPath</key>
    <string>{logfile}</string>
    <key>StandardErrorPath</key>
    <string>{errfile}</string>

    <!-- Do NOT run immediately on login, only at the scheduled time -->
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
"""


def mac_create(hour: int, minute: int):
    log_dir = Path(work_dir()) / "data"
    log_dir.mkdir(parents=True, exist_ok=True)

    plist_content = MAC_PLIST_TEMPLATE.format(
        label=TASK_NAME,
        python=python_exe(),
        script=run_script(),
        workdir=work_dir(),
        hour=hour,
        minute=minute,
        logfile=str(log_dir / "launchd.log"),
        errfile=str(log_dir / "launchd_error.log"),
    )

    # Write the plist
    PLIST_PATH.parent.mkdir(parents=True, exist_ok=True)
    PLIST_PATH.write_text(plist_content)
    print(f"  Plist written → {PLIST_PATH}")

    # Unload first in case it was already registered
    subprocess.run(["launchctl", "unload", str(PLIST_PATH)],
                   capture_output=True)

    # Load it
    result = subprocess.run(["launchctl", "load", str(PLIST_PATH)],
                            capture_output=True, text=True)
    if result.returncode == 0:
        print(f"\n✓  Scheduled task registered with launchd!")
        print(f"   Runs:   Mon–Fri at {hour:02d}:{minute:02d}")
        print(f"   Script: {run_script()}")
        print(f"   Log:    {log_dir / 'launchd.log'}")
        print(f"\n   To test right now:  python run.py --preview")
        print(f"   To check status:    launchctl list | grep legaldaily")
    else:
        print(f"\n❌  launchctl load failed:\n{result.stderr}")
        print("    Check that the plist path is correct and try again.")


def mac_remove():
    if PLIST_PATH.exists():
        subprocess.run(["launchctl", "unload", str(PLIST_PATH)], capture_output=True)
        PLIST_PATH.unlink()
        print(f"✓  Task unregistered and plist removed ({PLIST_PATH})")
    else:
        print("No scheduled task found — nothing to remove.")


def mac_status():
    result = subprocess.run(["launchctl", "list", TASK_NAME],
                            capture_output=True, text=True)
    if result.returncode == 0:
        print(f"✓  Task '{TASK_NAME}' is registered:\n{result.stdout}")
    else:
        print(f"  Task '{TASK_NAME}' is NOT registered.")
    if PLIST_PATH.exists():
        print(f"  Plist: {PLIST_PATH}")


# ── Windows schtasks ───────────────────────────────────────────────────────

def win_create(hour: int, minute: int):
    cmd = [
        "schtasks", "/Create",
        "/TN", TASK_NAME,
        "/TR", f'"{python_exe()}" "{run_script()}"',
        "/SC", "WEEKLY",
        "/D",  "MON,TUE,WED,THU,FRI",
        "/ST", f"{hour:02d}:{minute:02d}",
        "/RL", "HIGHEST",
        "/F",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"\n✓  Task '{TASK_NAME}' registered in Windows Task Scheduler!")
        print(f"   Runs:   Mon–Fri at {hour:02d}:{minute:02d}")
        print(f"\n   To test right now:  python run.py --preview")
    else:
        print(f"\n❌  schtasks failed:\n{result.stderr}")
        print("    Try running this script as Administrator.")


def win_remove():
    result = subprocess.run(
        ["schtasks", "/Delete", "/TN", TASK_NAME, "/F"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"✓  Task '{TASK_NAME}' removed from Task Scheduler.")
    else:
        print(f"Task not found or could not be removed:\n{result.stderr}")


def win_status():
    result = subprocess.run(
        ["schtasks", "/Query", "/TN", TASK_NAME],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"✓  Task is registered:\n{result.stdout}")
    else:
        print(f"  Task '{TASK_NAME}' is NOT registered.")


# ── Entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Set up the daily brief scheduled task")
    parser.add_argument("--remove", action="store_true", help="Unregister the scheduled task")
    parser.add_argument("--status", action="store_true", help="Check whether the task is registered")
    args = parser.parse_args()

    is_mac = sys.platform == "darwin"
    is_win = sys.platform == "win32"
    hour, minute = parse_time(SEND_TIME)

    if is_mac:
        if args.remove:   mac_remove()
        elif args.status: mac_status()
        else:             mac_create(hour, minute)
    elif is_win:
        if args.remove:   win_remove()
        elif args.status: win_status()
        else:             win_create(hour, minute)
    else:
        # Linux / other — fall back to crontab
        cron_line = f"{minute} {hour} * * 1-5 cd {work_dir()} && {python_exe()} {run_script()}"
        print("Linux detected. Add this line to your crontab (run: crontab -e):")
        print(f"\n  {cron_line}\n")
