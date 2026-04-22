from fastapi import Request

from app.config import settings


def _set_session_cookie(response, session_token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )


async def session_refresh_middleware(request: Request, call_next):
    response = await call_next(request)
    refresh_token = getattr(request.state, "refresh_session_token", None)
    if refresh_token:
        _set_session_cookie(response, refresh_token)
    return response
