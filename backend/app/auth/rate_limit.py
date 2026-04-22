from collections import defaultdict, deque
from threading import Lock
from time import time

from fastapi import HTTPException, Request

from app.config import settings


_attempts: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def enforce_auth_rate_limit(request: Request) -> None:
    now = time()
    window_start = now - settings.auth_rate_limit_window_seconds
    key = f"{request.url.path}:{_client_ip(request)}"

    with _lock:
        attempts = _attempts[key]
        while attempts and attempts[0] <= window_start:
            attempts.popleft()

        if len(attempts) >= settings.auth_rate_limit_attempts:
            raise HTTPException(
                status_code=429,
                detail="Too many authentication attempts. Please try again later.",
            )

        attempts.append(now)


def reset_rate_limits() -> None:
    with _lock:
        _attempts.clear()
