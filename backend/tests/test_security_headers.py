from fastapi.testclient import TestClient

from app.main import app


def test_security_headers_present_on_responses():
    client = TestClient(app)
    resp = client.get("/health")

    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "DENY"
    assert resp.headers["Referrer-Policy"] == "no-referrer"
    assert resp.headers["Content-Security-Policy"] == (
        "default-src 'none'; frame-ancestors 'none'"
    )
    assert "camera=()" in resp.headers["Permissions-Policy"]
    # Local env: HSTS intentionally absent (no TLS on localhost)
    assert "Strict-Transport-Security" not in resp.headers
