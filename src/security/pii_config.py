"""
PII Detection Configuration for Inception Engine.
Defines detection rules, sensitivity levels, and
category-specific settings.
"""

from typing import Optional, Dict, List, Set
from dataclasses import dataclass, field
from enum import Enum


class SensitivityLevel(str, Enum):
    """PII detection sensitivity levels."""
    STRICT = "strict"       # Maximum detection, may have false positives
    MODERATE = "moderate"   # Balanced detection (default)
    PERMISSIVE = "permissive"  # Minimal detection, fewer false positives


class PIICategory(str, Enum):
    """Categories of PII data."""
    IDENTITY = "identity"       # Names, SSN, passport, driver's license
    CONTACT = "contact"         # Email, phone, address
    FINANCIAL = "financial"     # Credit card, bank account, IBAN
    MEDICAL = "medical"         # Medical record numbers, conditions
    NETWORK = "network"         # IP addresses, MAC addresses
    TEMPORAL = "temporal"       # Date of birth, age
    CREDENTIAL = "credential"   # Passwords, API keys, tokens
    BIOMETRIC = "biometric"     # Fingerprints, facial data references


class PIISeverity(str, Enum):
    """Severity level for detected PII."""
    CRITICAL = "critical"   # SSN, credit card, passwords
    HIGH = "high"           # Full name + address, medical records
    MEDIUM = "medium"       # Email, phone number
    LOW = "low"             # IP address, partial names


@dataclass
class PIIRule:
    """A single PII detection rule."""
    name: str
    pattern: str
    category: PIICategory
    severity: PIISeverity
    description: str = ""
    enabled: bool = True
    min_sensitivity: SensitivityLevel = SensitivityLevel.MODERATE
    example: str = ""
    false_positive_rate: float = 0.0


@dataclass
class PIIDetectionConfig:
    """Full PII detection configuration."""
    sensitivity: SensitivityLevel = SensitivityLevel.MODERATE
    enabled_categories: Set[PIICategory] = field(
        default_factory=lambda: set(PIICategory)
    )
    custom_rules: List[PIIRule] = field(default_factory=list)
    scan_inputs: bool = True
    scan_outputs: bool = True
    scan_memory_writes: bool = True
    auto_redact: bool = False
    log_detections: bool = True
    max_text_length: int = 50000
    batch_size: int = 100


# ── Default Detection Rules ──────────────────────────────

DEFAULT_PII_RULES: List[PIIRule] = [
    # Identity
    PIIRule(
        name="ssn",
        pattern=r"\b\d{3}-\d{2}-\d{4}\b",
        category=PIICategory.IDENTITY,
        severity=PIISeverity.CRITICAL,
        description="US Social Security Number",
        example="123-45-6789",
    ),
    PIIRule(
        name="passport",
        pattern=r"\b[A-Z]{1,2}\d{6,9}\b",
        category=PIICategory.IDENTITY,
        severity=PIISeverity.CRITICAL,
        description="Passport number",
        min_sensitivity=SensitivityLevel.STRICT,
        false_positive_rate=0.15,
    ),
    # Contact
    PIIRule(
        name="email",
        pattern=r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        category=PIICategory.CONTACT,
        severity=PIISeverity.MEDIUM,
        description="Email address",
        example="user@example.com",
    ),
    PIIRule(
        name="phone_us",
        pattern=r"(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",
        category=PIICategory.CONTACT,
        severity=PIISeverity.MEDIUM,
        description="US phone number",
        example="(555) 123-4567",
    ),
    PIIRule(
        name="phone_intl",
        pattern=r"\+\d{1,3}[-.\s]?\d{4,14}",
        category=PIICategory.CONTACT,
        severity=PIISeverity.MEDIUM,
        description="International phone number",
        min_sensitivity=SensitivityLevel.STRICT,
    ),
    # Financial
    PIIRule(
        name="credit_card",
        pattern=r"\b(?:\d{4}[-.\s]?){3}\d{4}\b",
        category=PIICategory.FINANCIAL,
        severity=PIISeverity.CRITICAL,
        description="Credit card number",
        example="4111-1111-1111-1111",
    ),
    PIIRule(
        name="iban",
        pattern=r"\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b",
        category=PIICategory.FINANCIAL,
        severity=PIISeverity.HIGH,
        description="International Bank Account Number",
        min_sensitivity=SensitivityLevel.STRICT,
    ),
    # Network
    PIIRule(
        name="ipv4",
        pattern=r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
        category=PIICategory.NETWORK,
        severity=PIISeverity.LOW,
        description="IPv4 address",
        example="192.168.1.1",
    ),
    PIIRule(
        name="ipv6",
        pattern=r"\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b",
        category=PIICategory.NETWORK,
        severity=PIISeverity.LOW,
        description="IPv6 address",
        min_sensitivity=SensitivityLevel.STRICT,
    ),
    # Temporal
    PIIRule(
        name="date_of_birth",
        pattern=r"\b(?:0[1-9]|1[0-2])/(?:0[1-9]|[12]\d|3[01])/(?:19|20)\d{2}\b",
        category=PIICategory.TEMPORAL,
        severity=PIISeverity.MEDIUM,
        description="Date of birth (MM/DD/YYYY)",
        example="01/15/1990",
    ),
    # Credential
    PIIRule(
        name="api_key",
        pattern=r"(?:api[_-]?key|apikey)[\s:=]+['"]?[a-zA-Z0-9_-]{20,}['"]?",
        category=PIICategory.CREDENTIAL,
        severity=PIISeverity.CRITICAL,
        description="API key pattern",
        min_sensitivity=SensitivityLevel.MODERATE,
    ),
    PIIRule(
        name="bearer_token",
        pattern=r"Bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+",
        category=PIICategory.CREDENTIAL,
        severity=PIISeverity.CRITICAL,
        description="Bearer/JWT token",
    ),
]


# ── Sensitivity Presets ───────────────────────────────

SENSITIVITY_PRESETS: Dict[SensitivityLevel, PIIDetectionConfig] = {
    SensitivityLevel.STRICT: PIIDetectionConfig(
        sensitivity=SensitivityLevel.STRICT,
        enabled_categories=set(PIICategory),
        scan_inputs=True,
        scan_outputs=True,
        scan_memory_writes=True,
        auto_redact=True,
        log_detections=True,
    ),
    SensitivityLevel.MODERATE: PIIDetectionConfig(
        sensitivity=SensitivityLevel.MODERATE,
        enabled_categories={
            PIICategory.IDENTITY,
            PIICategory.CONTACT,
            PIICategory.FINANCIAL,
            PIICategory.CREDENTIAL,
        },
        scan_inputs=True,
        scan_outputs=True,
        scan_memory_writes=True,
        auto_redact=False,
        log_detections=True,
    ),
    SensitivityLevel.PERMISSIVE: PIIDetectionConfig(
        sensitivity=SensitivityLevel.PERMISSIVE,
        enabled_categories={
            PIICategory.IDENTITY,
            PIICategory.FINANCIAL,
            PIICategory.CREDENTIAL,
        },
        scan_inputs=True,
        scan_outputs=False,
        scan_memory_writes=False,
        auto_redact=False,
        log_detections=True,
    ),
}


def get_rules_for_sensitivity(
    level: SensitivityLevel,
) -> List[PIIRule]:
    """Get PII rules applicable at a given sensitivity level."""
    level_order = {
        SensitivityLevel.PERMISSIVE: 0,
        SensitivityLevel.MODERATE: 1,
        SensitivityLevel.STRICT: 2,
    }
    current = level_order.get(level, 1)
    return [
        rule for rule in DEFAULT_PII_RULES
        if rule.enabled
        and level_order.get(rule.min_sensitivity, 1) <= current
    ]


def get_default_config(
    sensitivity: SensitivityLevel = SensitivityLevel.MODERATE,
) -> PIIDetectionConfig:
    """Get the default detection config for a sensitivity level."""
    return SENSITIVITY_PRESETS.get(
        sensitivity,
        SENSITIVITY_PRESETS[SensitivityLevel.MODERATE],
    )
