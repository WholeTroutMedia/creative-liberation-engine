"""
PII (Personally Identifiable Information) Detection for Inception Engine.
Scans text for sensitive data patterns and provides redaction.
"""

import re
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum


class PIIType(str, Enum):
    EMAIL = "email"
    PHONE = "phone"
    SSN = "ssn"
    CREDIT_CARD = "credit_card"
    IP_ADDRESS = "ip_address"
    DATE_OF_BIRTH = "date_of_birth"
    PASSPORT = "passport"
    DRIVERS_LICENSE = "drivers_license"
    ADDRESS = "address"
    NAME = "name"
    API_KEY = "api_key"
    PASSWORD = "password"
    BANK_ACCOUNT = "bank_account"
    CUSTOM = "custom"


class PIISeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


SEVERITY_MAP: Dict[PIIType, PIISeverity] = {
    PIIType.EMAIL: PIISeverity.MEDIUM,
    PIIType.PHONE: PIISeverity.MEDIUM,
    PIIType.SSN: PIISeverity.CRITICAL,
    PIIType.CREDIT_CARD: PIISeverity.CRITICAL,
    PIIType.IP_ADDRESS: PIISeverity.LOW,
    PIIType.DATE_OF_BIRTH: PIISeverity.MEDIUM,
    PIIType.PASSPORT: PIISeverity.CRITICAL,
    PIIType.DRIVERS_LICENSE: PIISeverity.HIGH,
    PIIType.ADDRESS: PIISeverity.MEDIUM,
    PIIType.API_KEY: PIISeverity.CRITICAL,
    PIIType.PASSWORD: PIISeverity.CRITICAL,
    PIIType.BANK_ACCOUNT: PIISeverity.CRITICAL,
}


@dataclass
class PIIMatch:
    """A detected PII occurrence."""
    pii_type: PIIType
    value: str
    start: int
    end: int
    severity: PIISeverity
    confidence: float
    context: str = ""


@dataclass
class PIIScanResult:
    """Result of a PII scan."""
    text_length: int
    matches: List[PIIMatch] = field(default_factory=list)
    redacted_text: str = ""
    has_pii: bool = False
    highest_severity: Optional[PIISeverity] = None
    summary: Dict[str, int] = field(default_factory=dict)


# Regex patterns for PII detection
PII_PATTERNS: Dict[PIIType, List[re.Pattern]] = {
    PIIType.EMAIL: [
        re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
    ],
    PIIType.PHONE: [
        re.compile(r'\b\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'),
        re.compile(r'\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b'),
    ],
    PIIType.SSN: [
        re.compile(r'\b\d{3}[-]\d{2}[-]\d{4}\b'),
        re.compile(r'\b\d{9}\b'),
    ],
    PIIType.CREDIT_CARD: [
        re.compile(r'\b(?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'),
        re.compile(r'\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b'),
    ],
    PIIType.IP_ADDRESS: [
        re.compile(r'\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b'),
    ],
    PIIType.API_KEY: [
        re.compile(r'\b(?:sk|pk|api|key|token)[-_][a-zA-Z0-9]{20,}\b', re.IGNORECASE),
        re.compile(r'\b[A-Za-z0-9]{32,64}\b'),
    ],
    PIIType.PASSWORD: [
        re.compile(r'(?:password|passwd|pwd)\s*[:=]\s*\S+', re.IGNORECASE),
    ],
    PIIType.DATE_OF_BIRTH: [
        re.compile(r'\b(?:0[1-9]|1[0-2])[/.-](?:0[1-9]|[12]\d|3[01])[/.-](?:19|20)\d{2}\b'),
    ],
}


class PIIDetector:
    """Detects and redacts PII from text."""

    def __init__(
        self,
        enabled_types: Optional[set[PIIType]] = None,
        custom_patterns: Optional[Dict[str, re.Pattern]] = None,
        redaction_char: str = "*",
        min_confidence: float = 0.7,
    ):
        self.enabled_types = enabled_types or set(PIIType)
        self.custom_patterns = custom_patterns or {}
        self.redaction_char = redaction_char
        self.min_confidence = min_confidence

    def scan(self, text: str) -> PIIScanResult:
        """Scan text for PII."""
        matches: List[PIIMatch] = []

        for pii_type, patterns in PII_PATTERNS.items():
            if pii_type not in self.enabled_types:
                continue
            for pattern in patterns:
                for match in pattern.finditer(text):
                    confidence = self._calculate_confidence(pii_type, match)
                    if confidence >= self.min_confidence:
                        context_start = max(0, match.start() - 20)
                        context_end = min(len(text), match.end() + 20)
                        matches.append(PIIMatch(
                            pii_type=pii_type,
                            value=match.group(),
                            start=match.start(),
                            end=match.end(),
                            severity=SEVERITY_MAP.get(pii_type, PIISeverity.MEDIUM),
                            confidence=confidence,
                            context=text[context_start:context_end],
                        ))

        # Custom patterns
        for name, pattern in self.custom_patterns.items():
            for match in pattern.finditer(text):
                matches.append(PIIMatch(
                    pii_type=PIIType.CUSTOM,
                    value=match.group(),
                    start=match.start(),
                    end=match.end(),
                    severity=PIISeverity.MEDIUM,
                    confidence=0.8,
                    context=f"custom:{name}",
                ))

        # Deduplicate overlapping matches
        matches = self._deduplicate(matches)

        # Build result
        summary: Dict[str, int] = {}
        highest = None
        severity_order = [PIISeverity.LOW, PIISeverity.MEDIUM, PIISeverity.HIGH, PIISeverity.CRITICAL]
        for m in matches:
            summary[m.pii_type.value] = summary.get(m.pii_type.value, 0) + 1
            if highest is None or severity_order.index(m.severity) > severity_order.index(highest):
                highest = m.severity

        return PIIScanResult(
            text_length=len(text),
            matches=matches,
            redacted_text=self.redact(text, matches),
            has_pii=len(matches) > 0,
            highest_severity=highest,
            summary=summary,
        )

    def redact(self, text: str, matches: Optional[List[PIIMatch]] = None) -> str:
        """Redact PII from text."""
        if matches is None:
            result = self.scan(text)
            matches = result.matches

        if not matches:
            return text

        sorted_matches = sorted(matches, key=lambda m: m.start, reverse=True)
        redacted = text
        for m in sorted_matches:
            replacement = self.redaction_char * len(m.value)
            redacted = redacted[:m.start] + replacement + redacted[m.end:]
        return redacted

    def scan_dict(self, data: Dict[str, Any], prefix: str = "") -> List[PIIMatch]:
        """Recursively scan dictionary values for PII."""
        all_matches: List[PIIMatch] = []
        for key, value in data.items():
            path = f"{prefix}.{key}" if prefix else key
            if isinstance(value, str):
                result = self.scan(value)
                for m in result.matches:
                    m.context = f"field:{path}"
                    all_matches.append(m)
            elif isinstance(value, dict):
                all_matches.extend(self.scan_dict(value, path))
            elif isinstance(value, list):
                for i, item in enumerate(value):
                    if isinstance(item, str):
                        result = self.scan(item)
                        for m in result.matches:
                            m.context = f"field:{path}[{i}]"
                            all_matches.append(m)
                    elif isinstance(item, dict):
                        all_matches.extend(self.scan_dict(item, f"{path}[{i}]"))
        return all_matches

    @staticmethod
    def _calculate_confidence(pii_type: PIIType, match: re.Match) -> float:
        """Calculate detection confidence based on pattern and context."""
        value = match.group()
        if pii_type == PIIType.EMAIL:
            return 0.95 if "@" in value and "." in value.split("@")[1] else 0.6
        elif pii_type == PIIType.PHONE:
            digits = re.sub(r'\D', '', value)
            return 0.9 if len(digits) >= 10 else 0.5
        elif pii_type == PIIType.SSN:
            return 0.85 if "-" in value else 0.4
        elif pii_type == PIIType.CREDIT_CARD:
            return 0.9 if len(re.sub(r'\D', '', value)) in (15, 16) else 0.5
        elif pii_type == PIIType.IP_ADDRESS:
            return 0.8
        elif pii_type == PIIType.API_KEY:
            return 0.85 if any(p in value.lower() for p in ("sk-", "pk-", "api_", "key_")) else 0.5
        elif pii_type == PIIType.PASSWORD:
            return 0.9
        return 0.7

    @staticmethod
    def _deduplicate(matches: List[PIIMatch]) -> List[PIIMatch]:
        """Remove overlapping matches, keeping highest severity."""
        if not matches:
            return []
        sorted_m = sorted(matches, key=lambda m: (m.start, -len(m.value)))
        result = [sorted_m[0]]
        for m in sorted_m[1:]:
            last = result[-1]
            if m.start >= last.end:
                result.append(m)
            elif m.severity.value > last.severity.value:
                result[-1] = m
        return result
