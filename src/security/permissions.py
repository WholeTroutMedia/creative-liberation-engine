"""
Permission decorators and guards for Inception Engine.
FastAPI dependency-based permission enforcement.
"""

from typing import Optional, List, Callable, Any
from functools import wraps
from enum import Enum

from .rbac import Permission, RBACManager, RoleLevel


# ── Global RBAC Instance ──────────────────────────────────
_rbac_manager: Optional[RBACManager] = None


def get_rbac_manager() -> RBACManager:
    """Get or create the global RBAC manager instance."""
    global _rbac_manager
    if _rbac_manager is None:
        _rbac_manager = RBACManager()
    return _rbac_manager


def set_rbac_manager(manager: RBACManager) -> None:
    """Set the global RBAC manager (for testing/DI)."""
    global _rbac_manager
    _rbac_manager = manager


# ── Permission Guards (FastAPI Dependencies) ──────────────

class PermissionDenied(Exception):
    """Raised when a user lacks required permissions."""
    def __init__(self, user_id: str, required: str, message: str = ""):
        self.user_id = user_id
        self.required = required
        self.message = message or f"User '{user_id}' lacks permission '{required}'"
        super().__init__(self.message)


class InsufficientRole(Exception):
    """Raised when a user's role level is too low."""
    def __init__(self, user_id: str, required_level: RoleLevel, message: str = ""):
        self.user_id = user_id
        self.required_level = required_level
        self.message = message or (
            f"User '{user_id}' requires role level {required_level.name}"
        )
        super().__init__(self.message)


def require_permission(permission: Permission):
    """
    FastAPI dependency that enforces a specific permission.

    Usage:
        @app.get("/agents", dependencies=[Depends(require_permission(Permission.AGENT_READ))])
        async def list_agents(): ...
    """
    async def dependency(user_id: str) -> bool:
        manager = get_rbac_manager()
        if not manager.check_permission(user_id, permission):
            raise PermissionDenied(user_id, permission.value)
        return True
    return dependency


def require_any_permission(*permissions: Permission):
    """
    FastAPI dependency that enforces at least one of the given permissions.

    Usage:
        @app.get("/data", dependencies=[Depends(require_any_permission(
            Permission.DATA_READ, Permission.ADMIN_AUDIT
        ))])
        async def read_data(): ...
    """
    async def dependency(user_id: str) -> bool:
        manager = get_rbac_manager()
        user_perms = manager.get_user_permissions(user_id)
        if not any(p in user_perms for p in permissions):
            names = ", ".join(p.value for p in permissions)
            raise PermissionDenied(
                user_id, names, f"User '{user_id}' lacks any of: {names}"
            )
        return True
    return dependency


def require_all_permissions(*permissions: Permission):
    """
    FastAPI dependency that enforces ALL given permissions.

    Usage:
        @app.delete("/agents/{id}", dependencies=[Depends(require_all_permissions(
            Permission.AGENT_DELETE, Permission.ADMIN_SETTINGS
        ))])
        async def delete_agent(id: str): ...
    """
    async def dependency(user_id: str) -> bool:
        manager = get_rbac_manager()
        user_perms = manager.get_user_permissions(user_id)
        missing = [p for p in permissions if p not in user_perms]
        if missing:
            names = ", ".join(p.value for p in missing)
            raise PermissionDenied(
                user_id, names, f"User '{user_id}' missing permissions: {names}"
            )
        return True
    return dependency


def require_role_level(min_level: RoleLevel):
    """
    FastAPI dependency that enforces a minimum role level.

    Usage:
        @app.post("/admin/settings", dependencies=[Depends(require_role_level(RoleLevel.ADMIN))])
        async def update_settings(): ...
    """
    async def dependency(user_id: str) -> bool:
        manager = get_rbac_manager()
        role_keys = manager._user_roles.get(user_id, set())
        max_level = 0
        for key in role_keys:
            role = manager._roles.get(key) or manager._roles.get(key.split(":")[-1])
            if role:
                max_level = max(max_level, role.level.value)
        if max_level < min_level.value:
            raise InsufficientRole(user_id, min_level)
        return True
    return dependency


def require_org_membership(org_id_param: str = "org_id"):
    """
    FastAPI dependency that ensures user belongs to the specified organization.

    Usage:
        @app.get("/orgs/{org_id}/data")
        async def get_org_data(org_id: str, _=Depends(require_org_membership())): ...
    """
    async def dependency(user_id: str, **kwargs) -> bool:
        org_id = kwargs.get(org_id_param)
        if not org_id:
            raise ValueError(f"Missing '{org_id_param}' parameter")
        manager = get_rbac_manager()
        org = manager._organizations.get(org_id)
        if not org:
            raise ValueError(f"Organization '{org_id}' not found")
        if user_id not in org.members:
            raise PermissionDenied(
                user_id, "org:member",
                f"User '{user_id}' is not a member of org '{org_id}'"
            )
        return True
    return dependency


def require_resource_owner(resource_owner_field: str = "owner_id"):
    """
    Guard that ensures the requesting user owns the resource.

    Usage:
        @require_resource_owner("created_by")
        async def delete_my_workflow(user_id: str, workflow: dict): ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, user_id: str = None, **kwargs) -> Any:
            resource = kwargs.get("resource") or (args[0] if args else None)
            if resource and isinstance(resource, dict):
                owner = resource.get(resource_owner_field)
                if owner and owner != user_id:
                    raise PermissionDenied(
                        user_id or "unknown",
                        "resource:owner",
                        "You do not own this resource",
                    )
            return await func(*args, user_id=user_id, **kwargs)
        return wrapper
    return decorator


# ── Scoped API Key Permissions ────────────────────────────

class APIKeyScope(str, Enum):
    """Scopes for API key access."""
    READ_ONLY = "read_only"
    READ_WRITE = "read_write"
    AGENT_EXECUTE = "agent_execute"
    PIPELINE_EXECUTE = "pipeline_execute"
    DATA_EXPORT = "data_export"
    FULL_ACCESS = "full_access"


SCOPE_PERMISSIONS: dict[APIKeyScope, set[Permission]] = {
    APIKeyScope.READ_ONLY: {
        Permission.AGENT_READ,
        Permission.PIPELINE_READ,
        Permission.DATA_READ,
    },
    APIKeyScope.READ_WRITE: {
        Permission.AGENT_READ, Permission.AGENT_WRITE,
        Permission.PIPELINE_READ, Permission.PIPELINE_WRITE,
        Permission.DATA_READ, Permission.DATA_WRITE,
    },
    APIKeyScope.AGENT_EXECUTE: {
        Permission.AGENT_READ, Permission.AGENT_EXECUTE,
    },
    APIKeyScope.PIPELINE_EXECUTE: {
        Permission.PIPELINE_READ, Permission.PIPELINE_EXECUTE,
    },
    APIKeyScope.DATA_EXPORT: {
        Permission.DATA_READ, Permission.DATA_EXPORT,
    },
    APIKeyScope.FULL_ACCESS: set(Permission),
}


def get_scope_permissions(scope: APIKeyScope) -> set[Permission]:
    """Get permissions granted by an API key scope."""
    return SCOPE_PERMISSIONS.get(scope, set())


def check_api_key_permission(
    scope: APIKeyScope, required_permission: Permission
) -> bool:
    """Check if an API key scope grants a specific permission."""
    return required_permission in get_scope_permissions(scope)


# ── Permission Utilities ──────────────────────────────────

def list_all_permissions() -> list[dict]:
    """List all available permissions with metadata."""
    return [
        {
            "name": p.name,
            "value": p.value,
            "category": p.value.split(":")[0],
            "action": p.value.split(":")[1] if ":" in p.value else p.value,
        }
        for p in Permission
    ]


def get_permissions_by_category(category: str) -> list[Permission]:
    """Get all permissions in a given category (e.g., 'agent', 'data')."""
    return [
        p for p in Permission if p.value.startswith(f"{category}:")
    ]
