from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./grc_demo.db"
    evidence_upload_dir: str = "./data/evidence"
    cors_origins: str = "http://localhost:3000,http://localhost:3002"
    app_name: str = "GRC Demo"
    app_env: str = "local"

    # ── Azure AD / Entra ID ──────────────────────────────────────────────────
    # Leave blank to disable. Set all three to enable Entra SSO.
    azure_tenant_id: str = ""
    azure_client_id: str = ""    # frontend app registration client ID
    azure_client_secret: str = ""  # only needed for server-side flows
    azure_audience: str = ""       # api://<backend-client-id> or frontend client ID

    # ── Okta ─────────────────────────────────────────────────────────────────
    # Leave blank to disable. Set all three to enable Okta SSO.
    okta_domain: str = ""          # e.g. yourorg.okta.com  (no https://)
    okta_client_id: str = ""       # Okta app client ID (frontend SPA app)
    okta_audience: str = "api://default"  # Okta authorization server audience

    # ── Email (Risk Review notifications) ────────────────────────────────────
    # Leave blank to disable sending — emails will be logged to console only.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    email_from: str = "grc-noreply@example.com"
    app_base_url: str = "http://localhost:3002"   # used to build links in emails

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def azure_enabled(self) -> bool:
        return bool(self.azure_tenant_id and self.azure_client_id)

    @property
    def okta_enabled(self) -> bool:
        return bool(self.okta_domain and self.okta_client_id)

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
