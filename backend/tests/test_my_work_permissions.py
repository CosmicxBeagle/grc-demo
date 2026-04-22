from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.local_auth import encode_token
from app.db.database import get_db
from app.routers.my_work import router as my_work_router


def test_my_work_allows_risk_owner(db):
    from .conftest import make_user

    user = make_user(db, role="risk_owner", display_name="Risk Owner", email="risk@example.com")

    app = FastAPI()
    app.include_router(my_work_router, prefix="/v1")
    app.dependency_overrides[get_db] = lambda: db

    client = TestClient(app)
    token = encode_token(user.id, user.username, user.role)
    response = client.get("/v1/my-work/queue", cookies={"session": token})

    assert response.status_code == 200
    assert response.json() == []


def test_my_work_blocks_role_without_permissions(db):
    from .conftest import make_user

    user = make_user(db, role="guest", display_name="Guest User", email="guest@example.com")

    app = FastAPI()
    app.include_router(my_work_router, prefix="/v1")
    app.dependency_overrides[get_db] = lambda: db

    client = TestClient(app)
    token = encode_token(user.id, user.username, user.role)
    response = client.get("/v1/my-work/queue", cookies={"session": token})

    assert response.status_code == 403
    assert "does not have any of the required permissions" in response.json()["detail"]
