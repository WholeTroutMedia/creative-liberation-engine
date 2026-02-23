"""
Security Middleware for Inception Engine.
FastAPI middleware for JWT auth, rate limiting, CORS, HTTPS redirect, and request logging.
"""

import time
import uuid
from typing import Optional, Dict, Set, Callable
from collections import defaultdict

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .jwt_handler import JWTHandler
from .rbac import RBACManager, Permission
from .audit_logger import AuditLogger, AuditEventType, AuditSeverity
from .pii_detector import PIIDetector


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """Middleware to validate JWT tokens on protected routes."""

    def __init__(
        self,
        app,
        jwt_handler: JWTHandler,
        exclude_paths: Optional[Set[str]] = None,
        exclude_prefixes: Optional[Set[str]] = None,
    ):
        super().__init__(app)
        self.jwt_handler = jwt_handler
        self.exclude_paths = exclude_paths or {
            "/health", "/docs", "/openapi.json", "/redoc",
            "/auth/login", "/auth/callback", "/auth/register",
        }
        self.exclude_prefixes = exclude_prefixes or {"/static", "/public"}

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if path in self.exclude_paths:
            return await call_next(request)
        for prefix in self.exclude_prefixes:
            if path.startswith(prefix):
                return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Missing or invalid authorization header"},
            )

        token = auth_header.split(" ", 1)[1]
        payload = self.jwt_handler.verify_token(token)
        if not payload:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid or expired token"},
            )

        request.state.user_id = payload.get("sub")
        request.state.email = payload.get("email")
        request.state.permissions = payload.get("permissions", [])
        request.state.roles = payload.get("roles", [])
        request.state.token_payload = payload

        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token bucket rate limiting middleware."""

    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        burst_size: int = 10,
        audit_logger: Optional[AuditLogger] = None,
    ):
        super().__init__(app)
        self.rpm = requests_per_minute
        self.burst = burst_size
        self.audit = audit_logger
        self._buckets: Dict[str, Dict] = defaultdict(
            lambda: {"tokens": burst_size, "last_refill": time.time()}
        )

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        user_id = getattr(request.state, "user_id", None)
        key = user_id or client_ip

        bucket = self._buckets[key]
        now = time.time()
        elapsed = now - bucket["last_refill"]
        bucket["tokens"] = min(
            self.burst,
            bucket["tokens"] + elapsed * (self.rpm / 60.0)
        )
        bucket["last_refill"] = now

        if bucket["tokens"] < 1:
            if self.audit:
                self.audit.log(
                    event_type=AuditEventType.SECURITY_RATE_LIMIT_HIT,
                    action="rate limit exceeded",
                    severity=AuditSeverity.WARNING,
                    user_id=user_id,
                    ip_address=client_ip,
                )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Rate limit exceeded"},
                headers={"Retry-After": "60"},
            )

        bucket["tokens"] -= 1
        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(int(bucket["tokens"]))
        response.headers["X-RateLimit-Limit"] = str(self.rpm)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """Redirect HTTP to HTTPS."""

    async def dispatch(self, request: Request, call_next):
        if request.url.scheme == "http" and request.headers.get("X-Forwarded-Proto") != "https":
            url = request.url.replace(scheme="https")
            return RedirectResponse(url=str(url), status_code=301)
        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs all requests for audit trail."""

    def __init__(self, app, audit_logger: AuditLogger):
        super().__init__(app)
        self.audit = audit_logger

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.time()

        response = await call_next(request)

        duration = time.time() - start
        user_id = getattr(request.state, "user_id", None)
        self.audit.log(
            event_type=AuditEventType.DATA_READ,
            action=f"{request.method} {request.url.path}",
            outcome=str(response.status_code),
            user_id=user_id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            resource=request.url.path,
            request_id=request_id,
            details={"duration_ms": round(duration * 1000, 2), "method": request.method},
        )

        response.headers["X-Request-ID"] = request_id
        return response


class PIIGuardMiddleware(BaseHTTPMiddleware):
    """Scans request/response bodies for PII leakage."""

    def __init__(
        self,
        app,
        pii_detector: PIIDetector,
        audit_logger: Optional[AuditLogger] = None,
        block_on_pii: bool = False,
    ):
        super().__init__(app)
        self.detector = pii_detector
        self.audit = audit_logger
        self.block_on_pii = block_on_pii

    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                body = await request.body()
                if body:
                    result = self.detector.scan(body.decode("utf-8", errors="ignore"))
                    if result.has_pii and self.audit:
                        user_id = getattr(request.state, "user_id", None)
                        self.audit.log_pii_detected(
                            user_id=user_id,
                            pii_types=list(result.summary.keys()),
                            resource=request.url.path,
                        )
                    if result.has_pii and self.block_on_pii:
                        return JSONResponse(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            content={"detail": "Request contains PII data that cannot be processed"},
                        )
            except Exception:
                pass

        return await call_next(request)


def setup_security_middleware(
    app,
    jwt_handler: JWTHandler,
    rbac_manager: RBACManager,
    audit_logger: AuditLogger,
    pii_detector: PIIDetector,
    enable_rate_limit: bool = True,
    enable_https_redirect: bool = False,
    enable_pii_guard: bool = True,
    rpm: int = 60,
) -> None:
    """Configure all security middleware on a FastAPI app."""
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestLoggingMiddleware, audit_logger=audit_logger)
    app.add_middleware(JWTAuthMiddleware, jwt_handler=jwt_handler)

    if enable_rate_limit:
        app.add_middleware(
            RateLimitMiddleware, requests_per_minute=rpm, audit_logger=audit_logger
        )
    if enable_https_redirect:
        app.add_middleware(HTTPSRedirectMiddleware)
    if enable_pii_guard:
        app.add_middleware(
            PIIGuardMiddleware, pii_detector=pii_detector, audit_logger=audit_logger
        )
