"""Inception Engine Security Module

HELIX EPSILON - Enterprise security hardening layer.
Provides OAuth 2.0, RBAC, encryption, PII detection, audit logging, and GDPR compliance.
"""

from .jwt_handler import JWTHandler, TokenPair
from .oauth import OAuthProvider, OAuthConfig
from .rbac import RBACManager, Role, Permission
from .middleware import SecurityMiddleware, require_auth, require_role
from .encryption import EncryptionManager
from .pii_detector import PIIDetector
from .audit_logger import AuditLogger, AuditEvent

__all__ = [
    "JWTHandler",
    "TokenPair",
    "OAuthProvider",
    "OAuthConfig",
    "RBACManager",
    "Role",
    "Permission",
    "SecurityMiddleware",
    "require_auth",
    "require_role",
    "EncryptionManager",
    "PIIDetector",
    "AuditLogger",
    "AuditEvent",
]

__version__ = "1.0.0"
