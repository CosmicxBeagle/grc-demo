from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    database_url: str = "sqlite:///./grc_demo.db"
    evidence_upload_dir: str = "./data/evidence"
    cors_origins: str = "http://localhost:3000"
    app_name: str = "GRC Demo"
    app_env: str = "local"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
