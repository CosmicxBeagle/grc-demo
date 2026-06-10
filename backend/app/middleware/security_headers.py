"""
Security response headers middleware.

Adds standard browser-protection headers to every response.  HSTS is only
sent in non-local environments (it is meaningless — and mildly annoying —
over plain http://localhost).

The API serves JSON, not HTML, so the CSP here is a strict deny-everything
policy: it exists to neutralise any response that a browser is somehow
convinced to render (e.g. a direct link to an error page or a downloaded
evidence file served inline).
"""
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response: Response = await call_next(request)
        headers = response.headers

        # Stop browsers from MIME-sniffing responses into executable types.
        headers.setdefault("X-Content-Type-Options", "nosniff")
        # This API must never be framed — blocks clickjacking.
        headers.setdefault("X-Frame-Options", "DENY")
        # Don't leak URLs (which may contain resource IDs) to other origins.
        headers.setdefault("Referrer-Policy", "no-referrer")
        # Deny-everything CSP for an API that should never render in a browser.
        headers.setdefault(
            "Content-Security-Policy",
            "default-src 'none'; frame-ancestors 'none'",
        )
        # No powerful browser features are ever needed by API responses.
        headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()",
        )

        # HSTS only where TLS is actually in play.
        if settings.app_env != "local":
            headers.setdefault(
                "Strict-Transport-Security",
                "max-age=63072000; includeSubDomains",
            )

        return response
