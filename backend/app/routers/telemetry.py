"""
Frontend telemetry ingestion endpoints.

The frontend ships error reports and events here. This router:

  1. Validates the payload (loose schema — frontend errors can be malformed)
  2. Logs to structured JSON via the application logger
     → Azure Container Apps forwards stdout to Azure Monitor automatically
     → The correlation X-Request-ID is injected by CorrelationMiddleware
  3. Stubs for Azure Application Insights direct forwarding (activated when
     APPINSIGHTS_CONNECTION_STRING env var is set — Codex wires this up during
     the Azure deployment phase)

Endpoints are intentionally unauthenticated so that auth failures can be
reported (a user who can't log in still needs to report their error). The
payloads contain no PII — only role, session ID, URL, and stack trace.

Rate limiting is handled at the infrastructure level (App Gateway / APIM).
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.middleware.correlation import get_request_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ClientError(BaseModel):
    message: str
    stack: Optional[str] = None
    component: Optional[str] = None       # React component or "api-client"
    request_id: Optional[str] = None      # the API request ID if error was on a call
    url: str
    user_role: Optional[str] = None       # never PII — just the role label
    session_id: str
    timestamp: str
    severity: str = Field(default="error", pattern="^(error|warning|info)$")


class ClientEvent(BaseModel):
    event: str                             # e.g. "page_view", "bulk_assign_applied"
    path: Optional[str] = None            # for page_view events
    properties: Optional[dict] = None
    session_id: str
    timestamp: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _appinsights_available() -> bool:
    """True when the Application Insights SDK is configured."""
    try:
        from app.config import settings
        return bool(getattr(settings, "appinsights_connection_string", ""))
    except Exception:
        return False


def _forward_to_appinsights(payload: dict, event_type: str) -> None:
    """
    Forward a telemetry payload directly to Azure Application Insights.
    Activated only when APPINSIGHTS_CONNECTION_STRING is set.
    No-op if the SDK is not installed — install with:
      pip install opencensus-ext-azure  OR  azure-monitor-opentelemetry
    """
    if not _appinsights_available():
        return
    try:
        # opencensus-ext-azure approach (lighter weight, no OTel setup needed):
        # from opencensus.ext.azure import log_exporter
        # from opencensus.trace import tracer
        # ...
        #
        # azure-monitor-opentelemetry approach (preferred for new deployments):
        # from azure.monitor.opentelemetry import configure_azure_monitor
        # configure_azure_monitor()  # done once at startup in main.py
        # Then just use standard logging — Azure Monitor picks it up.
        #
        # For now: log at DEBUG so it's visible in traces without polluting prod.
        logger.debug(
            "appinsights_forward",
            extra={"event_type": event_type, "payload": payload},
        )
    except Exception as exc:
        logger.warning("AppInsights forward failed: %s", exc)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/errors", status_code=202)
async def ingest_client_error(payload: ClientError, request: Request):
    """
    Receive a frontend error report and log it to structured output.

    Returns 202 Accepted immediately — we never want a telemetry failure
    to block the user or cause a secondary error on the frontend.

    The X-Request-ID from the correlation middleware is automatically
    included in every log record via the RequestIDFilter.
    """
    server_request_id = get_request_id()

    log_record = {
        "event": "client_error",
        "severity": payload.severity,
        "message": payload.message,
        "component": payload.component,
        "client_request_id": payload.request_id,   # the API call that failed
        "server_request_id": server_request_id,     # this telemetry request
        "url": payload.url,
        "user_role": payload.user_role,
        "session_id": payload.session_id,
        "client_timestamp": payload.timestamp,
        "server_timestamp": datetime.now(timezone.utc).isoformat(),
        # Truncate stack to 2000 chars — enough for diagnosis, avoids log bloat
        "stack": (payload.stack or "")[:2000] or None,
    }

    if payload.severity == "error":
        logger.error("client_error %s", payload.message, extra=log_record)
    elif payload.severity == "warning":
        logger.warning("client_warning %s", payload.message, extra=log_record)
    else:
        logger.info("client_info %s", payload.message, extra=log_record)

    _forward_to_appinsights(log_record, "exception")

    return {"accepted": True, "server_request_id": server_request_id}


@router.post("/events", status_code=202)
async def ingest_client_event(payload: ClientEvent, request: Request):
    """
    Receive a frontend event (page view, feature usage, etc.).

    Logged at INFO level — low noise, useful for usage analytics.
    """
    log_record = {
        "event": "client_event",
        "event_name": payload.event,
        "path": payload.path,
        "properties": payload.properties,
        "session_id": payload.session_id,
        "client_timestamp": payload.timestamp,
        "server_timestamp": datetime.now(timezone.utc).isoformat(),
    }

    logger.info("client_event %s", payload.event, extra=log_record)
    _forward_to_appinsights(log_record, "customEvent")

    return {"accepted": True}
