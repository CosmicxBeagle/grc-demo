from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.schemas.schemas import UserOut, UserRoleUpdate, UserStatusUpdate, UserCreateManual
from app.services.services import UserService
from app.auth.local_auth import get_current_user
from app.auth.permissions import require_permission
from app.models.models import User

router = APIRouter(prefix="/users", tags=["users"])

VALID_ROLES = {"admin", "grc_manager", "grc_analyst", "tester", "reviewer", "risk_owner", "viewer"}


@router.get("", response_model=list[UserOut])
def list_users(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("users:read")),
):
    return UserService(db).list_users(status=status)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("users:read")),
):
    return UserService(db).get_user(user_id)


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    data: UserCreateManual,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("users:write")),
):
    """Manually create a local/pending user (e.g. before their first SSO login)."""
    return UserService(db).create_user(data)


@router.patch("/{user_id}/role", response_model=UserOut)
def update_role(
    user_id: int,
    data: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users:manage_roles")),
):
    """Assign a role to a user. Only admins can do this."""
    if data.role not in VALID_ROLES:
        raise HTTPException(400, f"Invalid role. Valid roles: {sorted(VALID_ROLES)}")
    if user_id == current_user.id and data.role != "admin":
        raise HTTPException(400, "You cannot remove your own admin role.")
    return UserService(db).update_role(user_id, data.role)


@router.patch("/{user_id}/status", response_model=UserOut)
def update_status(
    user_id: int,
    data: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users:write")),
):
    """Activate or deactivate a user account."""
    if user_id == current_user.id:
        raise HTTPException(400, "You cannot deactivate your own account.")
    return UserService(db).update_status(user_id, data.status)


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users:write")),
):
    if user_id == current_user.id:
        raise HTTPException(400, "You cannot delete your own account.")
    UserService(db).delete_user(user_id)
