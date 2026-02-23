"""
Audit Logger for Inception Engine.
Provides comprehensive audit trail for security events, data access, and admin actions.
"""

import time
import json
import uuid
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import deque


class AuditEventType(str, Enum):
    # Authentication events
    AUTH_LOGIN = "auth.login"
    AUTH_LOGOUT = "auth.logout"
    AUTH_LOGIN_FAILED = "auth.login_failed"
    AUTH_TOKEN_REFRESH = "auth.token_refresh"
    AUTH_TOKEN_REVOKED = "auth.token_revoked"
    AUTH_PASSWORD_CHANGE = "auth.password_change"
    AUTH_MFA_ENABLED = "auth.mfa_enabled"
    # Authorization events
    AUTHZ_PERMISSION_GRANTED = "authz.permission_granted"
    AUTHZ_PERMISSION_DENIED = "authz.permission_denied"
    AUTHZ_ROLE_ASSIGNED = "authz.role_assigned"
    AUTHZ_ROLE_REVOKED = "authz.role_revoked"
    # Data events
    DATA_READ = "data.read"
    DATA_WRITE = "data.write"
    DATA_DELETE = "data.delete"
    DATA_EXPORT = "data.export"
    DATA_IMPORT = "data.import"
    # Agent events
    AGENT_CREATED = "agent.created"
    AGENT_EXECUTED = "agent.executed"
    AGENT_MODIFIED = "agent.modified"
    AGENT_DELETED = "agent.deleted"
    # Admin events
    ADMIN_SETTINGS_CHANGED = "admin.settings_changed"
    ADMIN_USER_CREATED = "admin.user_created"
    ADMIN_USER_DELETED = "admin.user_deleted"
    ADMIN_USER_SUSPENDED = "admin.user_suspended"
    # Security events
    SECURITY_PII_DETECTED = "security.pii_detected"
    SECURITY_ENCRYPTION_KEY_ROTATED = "security.key_rotated"
    SECURITY_SUSPICIOUS_ACTIVITY = "security.suspicious_activity"
    SECURITY_RATE_LIMIT_HIT = "security.rate_limit_hit"
    # GDPR events
    GDPR_DATA_REQUEST = "gdpr.data_request"
    GDPR_DATA_EXPORTED = "gdpr.data_exported"
    GDPR_DATA_DELETED = "gdpr.data_deleted"
    GDPR_CONSENT_UPDATED = "gdpr.consent_updated"


class AuditSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class AuditEvent:
    """Represents a single audit log entry."""
    event_id: str
    event_type: AuditEventType
    severity: AuditSeverity
    timestamp: float
    user_id: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    resource: Optional[str]
    action: str
    outcome: str
    details: Dict[str, Any] = field(default_factory=dict)
    org_id: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self) -> str:
        d = self.to_dict()
        d["event_type"] = self.event_type.value
        d["severity"] = self.severity.value
        return json.dumps(d)


class AuditLogger:
    """Comprehensive audit logging system."""

    def __init__(
        self,
        max_memory_events: int = 10000,
        log_to_file: bool = True,
        log_file: str = "audit.log",
        log_to_stdout: bool = False,
    ):
        self._events: deque = deque(maxlen=max_memory_events)
        self._logger = logging.getLogger("inception.audit")
        self._logger.setLevel(logging.DEBUG)

        if log_to_file:
            fh = logging.FileHandler(log_file)
            fh.setFormatter(logging.Formatter("%(message)s"))
            self._logger.addHandler(fh)

        if log_to_stdout:
            sh = logging.StreamHandler()
            sh.setFormatter(logging.Formatter("%(message)s"))
            self._logger.addHandler(sh)

    def log(
        self,
        event_type: AuditEventType,
        action: str,
        outcome: str = "success",
        severity: AuditSeverity = AuditSeverity.INFO,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        resource: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        org_id: Optional[str] = None,
        session_id: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> AuditEvent:
        """Log an audit event."""
        event = AuditEvent(
            event_id=str(uuid.uuid4()),
            event_type=event_type,
            severity=severity,
            timestamp=time.time(),
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            resource=resource,
            action=action,
            outcome=outcome,
            details=details or {},
            org_id=org_id,
            session_id=session_id,
            request_id=request_id,
        )
        self._events.append(event)
        self._logger.info(event.to_json())
        return event

    # ── Convenience Logging Methods ──────────────────────

    def log_login(self, user_id: str, ip: str, provider: str = "local", success: bool = True) -> AuditEvent:
        return self.log(
            event_type=AuditEventType.AUTH_LOGIN if success else AuditEventType.AUTH_LOGIN_FAILED,
            action=f"login via {provider}",
            outcome="success" if success else "failed",
            severity=AuditSeverity.INFO if success else AuditSeverity.WARNING,
            user_id=user_id,
            ip_address=ip,
            details={"provider": provider},
        )

    def log_logout(self, user_id: str, session_id: str) -> AuditEvent:
        return self.log(
            event_type=AuditEventType.AUTH_LOGOUT,
            action="logout",
            user_id=user_id,
            session_id=session_id,
        )

    def log_permission_denied(self, user_id: str, permission: str, resource: str) -> AuditEvent:
        return self.log(
            event_type=AuditEventType.AUTHZ_PERMISSION_DENIED,
            action=f"access denied: {permission}",
            outcome="denied",
            severity=AuditSeverity.WARNING,
            user_id=user_id,
            resource=resource,
            details={"permission": permission},
        )

    def log_data_access(self, user_id: str, resource: str, action: str = "read") -> AuditEvent:
        event_map = {
            "read": AuditEventType.DATA_READ,
            "write": AuditEventType.DATA_WRITE,
            "delete": AuditEventType.DATA_DELETE,
            "export": AuditEventType.DATA_EXPORT,
        }
        return self.log(
            event_type=event_map.get(action, AuditEventType.DATA_READ),
            action=f"data {action}",
            user_id=user_id,
            resource=resource,
        )

    def log_pii_detected(self, user_id: Optional[str], pii_types: List[str], resource: str) -> AuditEvent:
        return self.log(
            event_type=AuditEventType.SECURITY_PII_DETECTED,
            action="pii detected",
            severity=AuditSeverity.WARNING,
            user_id=user_id,
            resource=resource,
            details={"pii_types": pii_types},
        )

    def log_suspicious_activity(self, user_id: Optional[str], ip: str, reason: str) -> AuditEvent:
        return self.log(
            event_type=AuditEventType.SECURITY_SUSPICIOUS_ACTIVITY,
            action="suspicious activity detected",
            severity=AuditSeverity.CRITICAL,
            user_id=user_id,
            ip_address=ip,
            details={"reason": reason},
        )

    # ── Query Methods ────────────────────────────────────

    def get_events(
        self,
        event_type: Optional[AuditEventType] = None,
        user_id: Optional[str] = None,
        severity: Optional[AuditSeverity] = None,
        since: Optional[float] = None,
        limit: int = 100,
    ) -> List[AuditEvent]:
        """Query audit events with filters."""
        results = []
        for event in reversed(self._events):
            if event_type and event.event_type != event_type:
                continue
            if user_id and event.user_id != user_id:
                continue
            if severity and event.severity != severity:
                continue
            if since and event.timestamp < since:
                continue
            results.append(event)
            if len(results) >= limit:
                break
        return results

    def get_user_activity(self, user_id: str, limit: int = 50) -> List[AuditEvent]:
        """Get recent activity for a specific user."""
        return self.get_events(user_id=user_id, limit=limit)

    def get_security_events(self, since: Optional[float] = None, limit: int = 100) -> List[AuditEvent]:
        """Get security-related events."""
        security_types = {
            AuditEventType.AUTH_LOGIN_FAILED,
            AuditEventType.AUTHZ_PERMISSION_DENIED,
            AuditEventType.SECURITY_PII_DETECTED,
            AuditEventType.SECURITY_SUSPICIOUS_ACTIVITY,
            AuditEventType.SECURITY_RATE_LIMIT_HIT,
        }
        results = []
        for event in reversed(self._events):
            if event.event_type in security_types:
                if since and event.timestamp < since:
                    continue
                results.append(event)
                if len(results) >= limit:
                    break
        return results

    def export_events(
        self, since: Optional[float] = None, until: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """Export audit events as dictionaries (for compliance)."""
        results = []
        for event in self._events:
            if since and event.timestamp < since:
                continue
            if until and event.timestamp > until:
                continue
            results.append(event.to_dict())
        return results

    @property
    def event_count(self) -> int:
        return len(self._events)
