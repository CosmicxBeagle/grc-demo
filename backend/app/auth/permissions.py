"""
Permission-based access control.

Roles map to sets of permissions. Code checks permissions, not roles directly,
so adding a new role never requires touching router code.

Usage in routers:
    from app.auth.permissions import require_permission

    @router.post("/exceptions/{id}/approve")
    def approve(id: int, user: User = Depends(require_permission("exceptions:approve"))):
        ...
"""
from fastapi import Depends, HTTPException
from app.auth.local_auth import get_current_user
from app.models.models import User

# ── Permission definitions ────────────────────────────────────────────────────
# Format: "resource:action"

PERMISSIONS = {
    # Controls
    "controls:read",
    "controls:write",
    "controls:delete",
    # Test cycles & assignments
    "tests:read",
    "tests:write",
    "tests:submit_for_review",
    # Evidence
    "evidence:read",
    "evidence:write",
    # Exceptions
    "exceptions:read",
    "exceptions:write",
    "exceptions:approve",
    # Approvals
    "approvals:read",
    "approvals:decide",
    "approvals:manage_policies",
    # Deficiencies
    "deficiencies:read",
    "deficiencies:write",
    # Risks
    "risks:read",
    "risks:write",
    "risks:review_update",
    # Assets & Threats
    "assets:read",
    "assets:write",
    "threats:read",
    "threats:write",
    # Reports / Exports
    "reports:export",
    # User management
    "users:read",
    "users:write",
    "users:manage_roles",
    # Settings
    "settings:read",
    "settings:write",
}

# ── Role → Permission matrix ──────────────────────────────────────────────────

ROLE_PERMISSIONS: dict[str, set[str]] = {

    "admin": {"*"},  # wildcard — all permissions

    "grc_manager": {
        "controls:read", "controls:write",
        "tests:read", "tests:write", "tests:submit_for_review",
        "evidence:read", "evidence:write",
        "exceptions:read", "exceptions:write", "exceptions:approve",
        "approvals:read", "approvals:decide", "approvals:manage_policies",
        "deficiencies:read", "deficiencies:write",
        "risks:read", "risks:write", "risks:review_update",
        "assets:read", "assets:write",
        "threats:read", "threats:write",
        "reports:export",
        "users:read",
        "settings:read", "settings:write",
    },

    "grc_analyst": {
        "controls:read", "controls:write",
        "tests:read", "tests:write", "tests:submit_for_review",
        "evidence:read", "evidence:write",
        "exceptions:read", "exceptions:write",
        "approvals:read",
        "deficiencies:read", "deficiencies:write",
        "risks:read", "risks:write", "risks:review_update",
        "assets:read", "assets:write",
        "threats:read", "threats:write",
        "reports:export",
        "users:read",
        "settings:read",
    },

    "tester": {
        "controls:read",
        "tests:read", "tests:write", "tests:submit_for_review",
        "evidence:read", "evidence:write",
        "exceptions:read",
        "approvals:read",
        "deficiencies:read",
        "risks:read",
        "assets:read",
        "threats:read",
        "reports:export",
    },

    "reviewer": {
        "controls:read",
        "tests:read",
        "evidence:read",
        "exceptions:read", "exceptions:approve",
        "approvals:read", "approvals:decide",
        "deficiencies:read", "deficiencies:write",
        "risks:read",
        "assets:read",
        "threats:read",
        "reports:export",
    },

    "risk_owner": {
        "controls:read",
        "tests:read",
        "evidence:read",
        "exceptions:read",
        "approvals:read",
        "deficiencies:read",
        "risks:read", "risks:review_update",
        "assets:read",
        "reports:export",
    },

    "viewer": {
        "controls:read",
        "tests:read",
        "evidence:read",
        "exceptions:read",
        "approvals:read",
        "deficiencies:read",
        "risks:read",
        "assets:read",
        "threats:read",
        "reports:export",
    },
}

# Keep legacy role names working during transition
ROLE_PERMISSIONS["admin"]    = ROLE_PERMISSIONS["admin"]
# "tester" and "reviewer" already defined above


# ── Helpers ───────────────────────────────────────────────────────────────────

def has_permission(role: str, permission: str) -> bool:
    perms = ROLE_PERMISSIONS.get(role, set())
    return "*" in perms or permission in perms


def require_permission(permission: str):
    """FastAPI dependency — raises 403 if the current user lacks the permission."""
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not has_permission(current_user.role, permission):
            raise HTTPException(
                status_code=403,
                detail=f"Your role '{current_user.role}' does not have permission: {permission}",
            )
        return current_user
    return dependency


# Convenience aliases for common checks
def require_admin():
    return require_permission("users:manage_roles")

def require_settings_write():
    return require_permission("settings:write")
