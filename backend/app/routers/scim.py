from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.scim import require_scim_bearer
from app.db.database import get_db
from app.schemas.schemas import SCIMUserCreate, SCIMUserOut, SCIMEmail, SCIMPatchRequest
from app.services.services import UserService


router = APIRouter(prefix="/scim/v2", tags=["scim"])


@router.post("/Users", response_model=SCIMUserOut, status_code=201, dependencies=[Depends(require_scim_bearer)])
def create_scim_user(
    data: SCIMUserCreate,
    db: Session = Depends(get_db),
):
    user = UserService(db).create_scim_user(data)
    return SCIMUserOut(
        id=str(user.id),
        userName=user.username,
        displayName=user.display_name,
        active=user.status == "active",
        emails=[SCIMEmail(value=user.email, primary=True)],
    )


@router.patch("/Users/{user_id}", response_model=SCIMUserOut, dependencies=[Depends(require_scim_bearer)])
def patch_scim_user(
    user_id: int,
    data: SCIMPatchRequest,
    db: Session = Depends(get_db),
):
    user = UserService(db).patch_scim_user(user_id, data)
    return SCIMUserOut(
        id=str(user.id),
        userName=user.username,
        displayName=user.display_name,
        active=user.status == "active",
        emails=[SCIMEmail(value=user.email, primary=True)],
    )


@router.delete("/Users/{user_id}", response_model=SCIMUserOut, dependencies=[Depends(require_scim_bearer)])
def delete_scim_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = UserService(db).deactivate_scim_user(user_id)
    return SCIMUserOut(
        id=str(user.id),
        userName=user.username,
        displayName=user.display_name,
        active=user.status == "active",
        emails=[SCIMEmail(value=user.email, primary=True)],
    )
