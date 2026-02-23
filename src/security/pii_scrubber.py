"""
PII Scrubber for Inception Engine.
Automated PII redaction with reversible tokenization
for authorized access.
"""

import re
import uuid
import time
import json
import hashlib
from typing import Optional, Dict, List, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum


class RedactionStrategy(str, Enum):
    """How to redact detected PII."""
    MASK = "mask"           # Replace with asterisks: ***
    HASH = "hash"           # Replace with hash: [SHA256:abc123]
    TOKEN = "token"         # Replace with reversible token: [PII:tok_xxx]
    CATEGORY = "category"   # Replace with category label: [EMAIL]
    REMOVE = "remove"       # Remove entirely


@dataclass
class RedactionRecord:
    """Record of a single PII redaction for audit trail."""
    record_id: str
    original_value: str
    redacted_value: str
    pii_type: str
    strategy: RedactionStrategy
    position_start: int
    position_end: int
    timestamp: float = field(default_factory=time.time)
    reversible: bool = False
    token: Optional[str] = None


@dataclass
class ScrubResult:
    """Result of a PII scrubbing operation."""
    original_text: str
    scrubbed_text: str
    redaction_count: int
    redactions: List[RedactionRecord]
    pii_types_found: List[str]
    processing_time_ms: float


class PIIScrubber:
    """
    Automated PII redaction engine.
    Supports multiple redaction strategies and reversible tokenization.
    """

    # Default PII patterns
    PII_PATTERNS = {
        "email": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        "phone_us": r"(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",
        "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
        "credit_card": r"\b(?:\d{4}[-.\s]?){3}\d{4}\b",
        "ip_address": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
        "date_of_birth": r"\b(?:0[1-9]|1[0-2])/(?:0[1-9]|[12]\d|3[01])/(?:19|20)\d{2}\b",
        "passport": r"\b[A-Z]{1,2}\d{6,9}\b",
        "iban": r"\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b",
    }

    def __init__(
        self,
        default_strategy: RedactionStrategy = RedactionStrategy.TOKEN,
        custom_patterns: Optional[Dict[str, str]] = None,
        strategy_overrides: Optional[Dict[str, RedactionStrategy]] = None,
    ):
        self._default_strategy = default_strategy
        self._patterns = dict(self.PII_PATTERNS)
        if custom_patterns:
            self._patterns.update(custom_patterns)
        self._strategy_overrides = strategy_overrides or {}
        self._token_store: Dict[str, str] = {}  # token -> original
        self._redaction_log: List[RedactionRecord] = []

    # ── Core Scrubbing ──────────────────────────────────

    def scrub(self, text: str) -> ScrubResult:
        """Scrub all detected PII from text."""
        start_time = time.time()
        redactions: List[RedactionRecord] = []
        result_text = text
        offset = 0

        # Collect all matches across all patterns
        all_matches: List[Tuple[int, int, str, str]] = []
        for pii_type, pattern in self._patterns.items():
            for match in re.finditer(pattern, text):
                all_matches.append((
                    match.start(), match.end(),
                    pii_type, match.group()
                ))

        # Sort by position (process right-to-left to maintain offsets)
        all_matches.sort(key=lambda m: m[0], reverse=True)

        for start, end, pii_type, original in all_matches:
            strategy = self._strategy_overrides.get(
                pii_type, self._default_strategy
            )
            replacement, token = self._apply_strategy(
                original, pii_type, strategy
            )

            record = RedactionRecord(
                record_id=f"red_{uuid.uuid4().hex[:12]}",
                original_value=original,
                redacted_value=replacement,
                pii_type=pii_type,
                strategy=strategy,
                position_start=start,
                position_end=end,
                reversible=(strategy == RedactionStrategy.TOKEN),
                token=token,
            )
            redactions.append(record)
            result_text = result_text[:start] + replacement + result_text[end:]

        # Reverse to get chronological order
        redactions.reverse()
        self._redaction_log.extend(redactions)

        elapsed = (time.time() - start_time) * 1000
        pii_types = list(set(r.pii_type for r in redactions))

        return ScrubResult(
            original_text=text,
            scrubbed_text=result_text,
            redaction_count=len(redactions),
            redactions=redactions,
            pii_types_found=pii_types,
            processing_time_ms=round(elapsed, 2),
        )

    def _apply_strategy(
        self, value: str, pii_type: str, strategy: RedactionStrategy
    ) -> Tuple[str, Optional[str]]:
        """Apply a redaction strategy and return (replacement, token)."""
        if strategy == RedactionStrategy.MASK:
            return "*" * len(value), None

        elif strategy == RedactionStrategy.HASH:
            h = hashlib.sha256(value.encode()).hexdigest()[:12]
            return f"[SHA256:{h}]", None

        elif strategy == RedactionStrategy.TOKEN:
            token = f"tok_{uuid.uuid4().hex[:10]}"
            self._token_store[token] = value
            return f"[PII:{token}]", token

        elif strategy == RedactionStrategy.CATEGORY:
            return f"[{pii_type.upper()}]", None

        elif strategy == RedactionStrategy.REMOVE:
            return "", None

        return f"[REDACTED]", None

    # ── Token Reversal (Authorized Access) ────────────────

    def reverse_token(self, token: str) -> Optional[str]:
        """Reverse a PII token to its original value (authorized access only)."""
        return self._token_store.get(token)

    def reverse_all_tokens(self, text: str) -> str:
        """Reverse all PII tokens in a text string."""
        result = text
        for token, original in self._token_store.items():
            result = result.replace(f"[PII:{token}]", original)
        return result

    def clear_token_store(self) -> int:
        """Clear the token store. Returns number of tokens cleared."""
        count = len(self._token_store)
        self._token_store.clear()
        return count

    # ── Compliance Reporting ─────────────────────────────

    def get_redaction_report(self) -> Dict[str, Any]:
        """Generate a PII redaction report for compliance audits."""
        type_counts: Dict[str, int] = {}
        for record in self._redaction_log:
            type_counts[record.pii_type] = (
                type_counts.get(record.pii_type, 0) + 1
            )

        return {
            "total_redactions": len(self._redaction_log),
            "pii_types_detected": type_counts,
            "active_tokens": len(self._token_store),
            "strategies_used": list(set(
                r.strategy.value for r in self._redaction_log
            )),
            "generated_at": time.time(),
        }

    def get_redaction_log(self) -> List[Dict[str, Any]]:
        """Get the full redaction log (without original values)."""
        return [
            {
                "record_id": r.record_id,
                "pii_type": r.pii_type,
                "strategy": r.strategy.value,
                "redacted_value": r.redacted_value,
                "position": f"{r.position_start}:{r.position_end}",
                "timestamp": r.timestamp,
                "reversible": r.reversible,
            }
            for r in self._redaction_log
        ]

    def clear_redaction_log(self) -> int:
        """Clear the redaction log. Returns count of entries cleared."""
        count = len(self._redaction_log)
        self._redaction_log.clear()
        return count
