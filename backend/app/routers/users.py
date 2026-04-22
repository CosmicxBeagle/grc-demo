from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.schemas.schemas import UserOut, UserRoleUpdate, UserStatusUpdate, UserCreateManual
from app.services.services import UserService
from app.services.deactivation_service import deactivate_user, get_open_work_summary
from app.auth.local_auth import get_current_user
from app.auth.permissions import require_permission
from app.models.models import User

router = APIRouter(prefix="/users", tags=["users"])

VALID_ROLES = {"admin", "grc_manager", "grc_analyst", "tester", "reviewer", "risk_owner", "viewer"}


class DeactivateRequest(BaseModel):
    reason: str = Field(..., min_length=5)
    reassign_to_user_id: Optional[int] = None


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


@router.post("/{user_id}/deactivate")
def deactivate(
    user_id: int,
    data: DeactivateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users:manage_roles")),
):
    """Soft-deactivate a user, reassigning open work if needed."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.deactivated_at is not None:
        raise HTTPException(status_code=400, detail="User is already deactivated")

    result = deactivate_user(db, target, current_user, data.reason, data.reassign_to_user_id)
    db.commit()
    return result


@router.get("/{user_id}/open-work")
def open_work_summary(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("users:manage_roles")),
):
    """Return a summary of open work for a user (pre-deactivation check)."""
    return get_open_work_summary(db, user_id)
