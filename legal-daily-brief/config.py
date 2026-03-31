"""Load all settings from .env (or environment variables)."""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")


class _Config:
    azure_tenant_id:      str  = os.getenv("AZURE_TENANT_ID", "")
    azure_client_id:      str  = os.getenv("AZURE_CLIENT_ID", "")
    outlook_calendar_name: str = os.getenv("OUTLOOK_CALENDAR_NAME", "")
    lookahead_days:       int  = int(os.getenv("LOOKAHEAD_DAYS", "30"))
    your_email:           str  = os.getenv("YOUR_EMAIL", "")
    send_time:            str  = os.getenv("SEND_TIME", "07:00")
    report_save_path:     Path = Path(os.getenv("REPORT_SAVE_PATH",
                                       str(Path(__file__).parent / "data" / "reports")))
    deadline_prefix:      str  = os.getenv("DEADLINE_PREFIX", "DD:")
    your_name:            str  = os.getenv("YOUR_NAME", "")
    firm_name:            str  = os.getenv("FIRM_NAME", "")

    def validate(self) -> list[str]:
        """Return a list of missing required settings."""
        missing = []
        if not self.azure_tenant_id: missing.append("AZURE_TENANT_ID")
        if not self.azure_client_id: missing.append("AZURE_CLIENT_ID")
        if not self.your_email:      missing.append("YOUR_EMAIL")
        return missing


cfg = _Config()
