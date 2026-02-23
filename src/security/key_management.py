"""
Key Management for Inception Engine.
Handles encryption key rotation, envelope encryption, and
integration with external key management services (KMS).
"""

import os
import time
import json
import hashlib
import secrets
import base64
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class KeyStatus(str, Enum):
    """Status of an encryption key."""
    ACTIVE = "active"
    ROTATING = "rotating"
    DEPRECATED = "deprecated"
    DESTROYED = "destroyed"


class KMSProvider(str, Enum):
    """Supported KMS providers."""
    LOCAL = "local"
    AWS_KMS = "aws_kms"
    GCP_KMS = "gcp_kms"
    HASHICORP_VAULT = "hashicorp_vault"


@dataclass
class KeyMetadata:
    """Metadata for a managed encryption key."""
    key_id: str
    created_at: float
    expires_at: float
    status: KeyStatus = KeyStatus.ACTIVE
    algorithm: str = "aes-256-gcm"
    rotation_count: int = 0
    last_rotated: Optional[float] = None
    kms_provider: KMSProvider = KMSProvider.LOCAL
    kms_key_ref: Optional[str] = None
    fingerprint: str = ""

    def is_expired(self) -> bool:
        return time.time() > self.expires_at

    def days_until_expiry(self) -> int:
        remaining = self.expires_at - time.time()
        return max(0, int(remaining / 86400))


@dataclass
class EncryptedDataKey:
    """A data key encrypted by a master key (envelope encryption)."""
    encrypted_key: bytes
    master_key_id: str
    algorithm: str = "aes-256-gcm"
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, str]:
        return {
            "encrypted_key": base64.b64encode(self.encrypted_key).decode(),
            "master_key_id": self.master_key_id,
            "algorithm": self.algorithm,
            "created_at": str(self.created_at),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> "EncryptedDataKey":
        return cls(
            encrypted_key=base64.b64decode(data["encrypted_key"]),
            master_key_id=data["master_key_id"],
            algorithm=data.get("algorithm", "aes-256-gcm"),
            created_at=float(data.get("created_at", 0)),
        )


class KeyRotationManager:
    """
    Manages encryption key lifecycle: generation, rotation,
    envelope encryption, and KMS integration.
    """

    def __init__(
        self,
        master_key: Optional[str] = None,
        rotation_days: int = 90,
        kms_provider: KMSProvider = KMSProvider.LOCAL,
    ):
        self._rotation_days = rotation_days
        self._kms_provider = kms_provider
        self._keys: Dict[str, bytes] = {}
        self._metadata: Dict[str, KeyMetadata] = {}
        self._active_key_id: Optional[str] = None

        # Initialize master key
        if master_key:
            self._master_key = base64.b64decode(master_key)
        else:
            env_key = os.environ.get("ENCRYPTION_MASTER_KEY", "")
            if env_key:
                self._master_key = base64.b64decode(env_key)
            else:
                self._master_key = AESGCM.generate_key(bit_length=256)

        self._initialize_default_key()

    def _initialize_default_key(self) -> None:
        """Create the initial active encryption key."""
        if not self._active_key_id:
            key_id = self.generate_key()
            self._active_key_id = key_id

    # ── Key Generation ───────────────────────────────────

    def generate_key(self, algorithm: str = "aes-256-gcm") -> str:
        """Generate a new encryption key and return its ID."""
        key_id = f"key_{secrets.token_hex(8)}_{int(time.time())}"
        raw_key = AESGCM.generate_key(bit_length=256)

        self._keys[key_id] = raw_key
        self._metadata[key_id] = KeyMetadata(
            key_id=key_id,
            created_at=time.time(),
            expires_at=time.time() + (self._rotation_days * 86400),
            algorithm=algorithm,
            kms_provider=self._kms_provider,
            fingerprint=hashlib.sha256(raw_key).hexdigest()[:16],
        )
        return key_id

    def get_active_key_id(self) -> str:
        """Get the current active encryption key ID."""
        if not self._active_key_id:
            raise RuntimeError("No active encryption key")
        return self._active_key_id

    def get_key(self, key_id: str) -> Optional[bytes]:
        """Retrieve a key by ID."""
        return self._keys.get(key_id)

    def get_key_metadata(self, key_id: str) -> Optional[KeyMetadata]:
        """Get metadata for a specific key."""
        return self._metadata.get(key_id)

    # ── Key Rotation ─────────────────────────────────────

    def rotate_key(self) -> str:
        """
        Rotate the active encryption key.
        Old key is deprecated but kept for decryption of existing data.
        """
        old_key_id = self._active_key_id

        # Mark old key as deprecated
        if old_key_id and old_key_id in self._metadata:
            self._metadata[old_key_id].status = KeyStatus.DEPRECATED

        # Generate new active key
        new_key_id = self.generate_key()
        self._active_key_id = new_key_id

        # Update rotation metadata
        meta = self._metadata[new_key_id]
        meta.rotation_count = (
            self._metadata[old_key_id].rotation_count + 1
            if old_key_id and old_key_id in self._metadata
            else 0
        )
        meta.last_rotated = time.time()

        return new_key_id

    def check_rotation_needed(self) -> bool:
        """Check if the active key needs rotation."""
        if not self._active_key_id:
            return True
        meta = self._metadata.get(self._active_key_id)
        if not meta:
            return True
        return meta.is_expired()

    def auto_rotate_if_needed(self) -> Optional[str]:
        """Rotate key automatically if expiry threshold is reached."""
        if self.check_rotation_needed():
            return self.rotate_key()
        return None

    # ── Envelope Encryption ──────────────────────────────

    def generate_data_key(self) -> tuple[bytes, EncryptedDataKey]:
        """
        Generate a data encryption key (DEK) and return both
        the plaintext DEK and its encrypted form (encrypted by master key).
        This implements the envelope encryption pattern.
        """
        # Generate plaintext data key
        plaintext_dek = AESGCM.generate_key(bit_length=256)

        # Encrypt DEK with master key
        aesgcm = AESGCM(self._master_key)
        nonce = os.urandom(12)
        encrypted_dek = nonce + aesgcm.encrypt(
            nonce, plaintext_dek, b"inception-engine-dek"
        )

        encrypted_data_key = EncryptedDataKey(
            encrypted_key=encrypted_dek,
            master_key_id="master",
        )

        return plaintext_dek, encrypted_data_key

    def decrypt_data_key(self, encrypted_data_key: EncryptedDataKey) -> bytes:
        """Decrypt an encrypted data key using the master key."""
        raw = encrypted_data_key.encrypted_key
        nonce = raw[:12]
        ciphertext = raw[12:]

        aesgcm = AESGCM(self._master_key)
        return aesgcm.decrypt(nonce, ciphertext, b"inception-engine-dek")

    # ── Key Lifecycle ───────────────────────────────────

    def destroy_key(self, key_id: str) -> bool:
        """Permanently destroy a key (cannot be undone)."""
        if key_id == self._active_key_id:
            raise ValueError("Cannot destroy the active key. Rotate first.")
        if key_id in self._keys:
            del self._keys[key_id]
        if key_id in self._metadata:
            self._metadata[key_id].status = KeyStatus.DESTROYED
        return True

    def list_keys(self, include_destroyed: bool = False) -> List[KeyMetadata]:
        """List all key metadata."""
        keys = list(self._metadata.values())
        if not include_destroyed:
            keys = [k for k in keys if k.status != KeyStatus.DESTROYED]
        return sorted(keys, key=lambda k: k.created_at, reverse=True)

    def get_rotation_schedule(self) -> Dict[str, Any]:
        """Get information about the key rotation schedule."""
        active_meta = self._metadata.get(self._active_key_id or "")
        return {
            "active_key_id": self._active_key_id,
            "rotation_interval_days": self._rotation_days,
            "days_until_rotation": (
                active_meta.days_until_expiry() if active_meta else 0
            ),
            "total_keys": len(self._metadata),
            "active_keys": sum(
                1 for m in self._metadata.values()
                if m.status == KeyStatus.ACTIVE
            ),
            "deprecated_keys": sum(
                1 for m in self._metadata.values()
                if m.status == KeyStatus.DEPRECATED
            ),
            "kms_provider": self._kms_provider.value,
        }
