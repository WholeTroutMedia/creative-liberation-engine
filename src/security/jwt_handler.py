"""JWT Token Handler for Inception Engine

Handles JWT creation, validation, refresh tokens, and token rotation.
Supports both access tokens (short-lived) and refresh tokens (long-lived).
"""

import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass, field

from jose import jwt, JWTError, ExpiredSignatureError
from passlib.context import CryptContext


@dataclass
class TokenPair:
    """Access + Refresh token pair."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900  # 15 minutes
    refresh_expires_in: int = 604800  # 7 days


@dataclass
class TokenPayload:
    """Decoded token payload."""
    sub: str  # user_id
    role: str
    permissions: list = field(default_factory=list)
    org_id: Optional[str] = None
    team_id: Optional[str] = None
    exp: Optional[datetime] = None
    iat: Optional[datetime] = None
    jti: Optional[str] = None  # unique token ID
    token_type: str = "access"


class JWTHandler:
    """JWT token management with rotation and revocation support."""

    def __init__(self):
        self.secret_key = os.getenv("JWT_SECRET", secrets.token_urlsafe(32))
        self.algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        self.access_token_expire = int(os.getenv("JWT_ACCESS_EXPIRE", "900"))
        self.refresh_token_expire = int(os.getenv("JWT_REFRESH_EXPIRE", "604800"))
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self._revoked_tokens: set = set()

    def create_token_pair(
        self,
        user_id: str,
        role: str,
        permissions: list = None,
        org_id: str = None,
        team_id: str = None,
    ) -> TokenPair:
        """Create an access + refresh token pair."""
        now = datetime.now(timezone.utc)
        access_jti = secrets.token_urlsafe(16)
        refresh_jti = secrets.token_urlsafe(16)

        access_payload = {
            "sub": user_id,
            "role": role,
            "permissions": permissions or [],
            "org_id": org_id,
            "team_id": team_id,
            "exp": now + timedelta(seconds=self.access_token_expire),
            "iat": now,
            "jti": access_jti,
            "token_type": "access",
        }

        refresh_payload = {
            "sub": user_id,
            "role": role,
            "exp": now + timedelta(seconds=self.refresh_token_expire),
            "iat": now,
            "jti": refresh_jti,
            "token_type": "refresh",
            "access_jti": access_jti,
        }

        access_token = jwt.encode(access_payload, self.secret_key, algorithm=self.algorithm)
        refresh_token = jwt.encode(refresh_payload, self.secret_key, algorithm=self.algorithm)

        return TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=self.access_token_expire,
            refresh_expires_in=self.refresh_token_expire,
        )

    def verify_token(self, token: str, token_type: str = "access") -> TokenPayload:
        """Verify and decode a JWT token."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])

            if payload.get("token_type") != token_type:
                raise JWTError(f"Expected {token_type} token, got {payload.get('token_type')}")

            jti = payload.get("jti")
            if jti and jti in self._revoked_tokens:
                raise JWTError("Token has been revoked")

            return TokenPayload(
                sub=payload["sub"],
                role=payload.get("role", "viewer"),
                permissions=payload.get("permissions", []),
                org_id=payload.get("org_id"),
                team_id=payload.get("team_id"),
                exp=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
                iat=datetime.fromtimestamp(payload["iat"], tz=timezone.utc),
                jti=jti,
                token_type=payload.get("token_type", "access"),
            )

        except ExpiredSignatureError:
            raise JWTError("Token has expired")
        except JWTError:
            raise

    def refresh_tokens(self, refresh_token: str) -> TokenPair:
        """Rotate tokens using a valid refresh token."""
        payload = self.verify_token(refresh_token, token_type="refresh")

        # Revoke the old refresh token (rotation)
        if payload.jti:
            self._revoked_tokens.add(payload.jti)

        return self.create_token_pair(
            user_id=payload.sub,
            role=payload.role,
            permissions=payload.permissions,
            org_id=payload.org_id,
            team_id=payload.team_id,
        )

    def revoke_token(self, token: str) -> bool:
        """Revoke a token by adding its JTI to the revocation list."""
        try:
            payload = jwt.decode(
                token, self.secret_key, algorithms=[self.algorithm],
                options={"verify_exp": False}
            )
            jti = payload.get("jti")
            if jti:
                self._revoked_tokens.add(jti)
                return True
        except JWTError:
            pass
        return False

    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt."""
        return self.pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return self.pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def generate_api_key() -> Tuple[str, str]:
        """Generate an API key pair (key, hashed_key)."""
        raw_key = secrets.token_urlsafe(32)
        hashed = hashlib.sha256(raw_key.encode()).hexdigest()
        return raw_key, hashed

    @staticmethod
    def verify_api_key(raw_key: str, hashed_key: str) -> bool:
        """Verify an API key against its hash."""
        return hashlib.sha256(raw_key.encode()).hexdigest() == hashed_key
