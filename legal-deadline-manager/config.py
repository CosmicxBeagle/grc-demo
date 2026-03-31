"""
Application configuration — loaded from .env via pydantic-settings.
"""

from functools import lru_cache
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    app_secret_key: str = "change-me-in-production"
    firm_name: str = "Law Firm"
    firm_email: str = ""

    # Database
    database_url: str = "sqlite:///./data/deadlines.db"

    # Encryption
    field_encryption_key: Optional[str] = None

    # Microsoft Graph
    azure_tenant_id: Optional[str] = None
    azure_client_id: Optional[str] = None
    azure_client_secret: Optional[str] = None
    graph_scopes: str = "Calendars.ReadWrite Tasks.ReadWrite Mail.Send User.Read"
    outlook_calendar_id: str = ""
    todo_list_name: str = "Legal Deadlines"

    # Attorney Sheet
    attorney_email: str = ""
    daily_sheet_time: str = "07:00"
    daily_sheet_save_path: str = "./data/reports/"

    # Needles
    needles_enabled: bool = False
    needles_odbc_connection_string: str = ""

    # Logging
    log_level: str = "INFO"
    log_file: str = "./data/app.log"

    @property
    def graph_scopes_list(self) -> List[str]:
        return self.graph_scopes.split()

    @property
    def is_graph_configured(self) -> bool:
        return bool(self.azure_tenant_id and self.azure_client_id)

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
