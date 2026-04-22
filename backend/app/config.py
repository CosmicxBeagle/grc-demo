from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./grc_demo.db"
    evidence_upload_dir: str = "./data/evidence"
    cors_origins: str = "http://localhost:3000,http://localhost:3002,http://localhost:61264"
    app_name: str = "GRC Demo"
    app_env: str = "local"
    debug: bool = False
    demo_auth_enabled: bool = False
    enable_api_docs: bool = True
    session_secret: str = "local-dev-session-secret-change-me"
    session_cookie_name: str = "session"
    session_cookie_samesite: str = "lax"
    session_timeout_minutes: int = 60
    auth_rate_limit_attempts: int = 10
    auth_rate_limit_window_seconds: int = 60
    scim_token: str = ""

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
    okta_client_secret: str = ""   # Okta web app client secret (OIDC code flow)
    okta_audience: str = "api://default"  # Okta authorization server audience
    okta_redirect_uri: str = ""
    okta_scopes: str = "openid profile email"

    # ── Azure Blob Storage (evidence files) ──────────────────────────────────
    # Leave blank to use local filesystem (dev / SQLite mode).
    # Set to just the storage account NAME (e.g. "mycompanygrc") to enable.
    # Container Apps managed identity is used automatically — no keys needed.
    azure_storage_account: str = ""
    azure_storage_container: str = "evidence"

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

    @property
    def okta_oidc_enabled(self) -> bool:
        return bool(self.okta_domain and self.okta_client_id and self.okta_client_secret and self.okta_redirect_uri)

    @property
    def demo_login_enabled(self) -> bool:
        return self.app_env == "local" and self.demo_auth_enabled

    @property
    def api_docs_enabled(self) -> bool:
        return self.enable_api_docs and (self.app_env == "local" or self.debug)

    @property
    def session_cookie_secure(self) -> bool:
        return self.app_env != "local"

    @property
    def scim_enabled(self) -> bool:
        return bool(self.scim_token)

    model_config = {
        "env_file": str(Path(__file__).resolve().parents[1] / ".env"),
        "env_file_encoding": "utf-8",
    }


settings = Settings()

