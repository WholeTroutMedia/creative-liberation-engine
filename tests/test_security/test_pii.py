"""Tests for PII Detection and Scrubbing."""
import pytest
from src.security.pii_detector import (
    PIIDetector, PIIType, PIISeverity, PIIMatch,
    PIIScanResult, SEVERITY_MAP, PII_PATTERNS,
)


class TestPIIType:
    def test_pii_types_exist(self):
        assert PIIType.EMAIL == "email"
        assert PIIType.PHONE == "phone"
        assert PIIType.SSN == "ssn"
        assert PIIType.CREDIT_CARD == "credit_card"
        assert PIIType.IP_ADDRESS == "ip_address"
        assert PIIType.API_KEY == "api_key"
        assert PIIType.PASSWORD == "password"

    def test_severity_map_completeness(self):
        assert PIIType.SSN in SEVERITY_MAP
        assert SEVERITY_MAP[PIIType.SSN] == PIISeverity.CRITICAL
        assert SEVERITY_MAP[PIIType.EMAIL] == PIISeverity.MEDIUM
        assert SEVERITY_MAP[PIIType.IP_ADDRESS] == PIISeverity.LOW


class TestPIIDetectorEmail:
    def test_detect_email(self):
        detector = PIIDetector()
        result = detector.scan("Contact us at user@example.com for info")
        assert result.has_pii
        assert "email" in result.summary

    def test_multiple_emails(self):
        detector = PIIDetector()
        text = "Send to alice@test.com and bob@example.org"
        result = detector.scan(text)
        assert result.summary.get("email", 0) >= 2

    def test_no_false_positive_email(self):
        detector = PIIDetector()
        result = detector.scan("This is a normal sentence without emails")
        assert "email" not in result.summary


class TestPIIDetectorPhone:
    def test_detect_us_phone(self):
        detector = PIIDetector()
        result = detector.scan("Call me at 555-123-4567")
        assert result.has_pii
        assert "phone" in result.summary

    def test_detect_formatted_phone(self):
        detector = PIIDetector()
        result = detector.scan("Phone: (555) 123-4567")
        assert result.has_pii


class TestPIIDetectorSSN:
    def test_detect_ssn(self):
        detector = PIIDetector()
        result = detector.scan("SSN: 123-45-6789")
        assert result.has_pii
        assert "ssn" in result.summary
        assert result.highest_severity == PIISeverity.CRITICAL


class TestPIIDetectorCreditCard:
    def test_detect_visa(self):
        detector = PIIDetector()
        result = detector.scan("Card: 4111-1111-1111-1111")
        assert result.has_pii
        assert "credit_card" in result.summary

    def test_detect_mastercard(self):
        detector = PIIDetector()
        result = detector.scan("Card: 5500 0000 0000 0004")
        assert result.has_pii


class TestPIIDetectorIPAddress:
    def test_detect_ip(self):
        detector = PIIDetector()
        result = detector.scan("Server IP: 192.168.1.100")
        assert result.has_pii
        assert "ip_address" in result.summary


class TestPIIDetectorPassword:
    def test_detect_password_pattern(self):
        detector = PIIDetector()
        result = detector.scan("password: my_secret_pass123")
        assert result.has_pii
        assert "password" in result.summary


class TestPIIDetectorAPIKey:
    def test_detect_api_key_prefix(self):
        detector = PIIDetector()
        result = detector.scan("Use key: sk-abcdefghijklmnopqrstuvwxyz")
        assert result.has_pii


class TestPIIRedaction:
    def test_redact_email(self):
        detector = PIIDetector()
        result = detector.scan("Email: user@example.com")
        assert "****" in result.redacted_text
        assert "user@example.com" not in result.redacted_text

    def test_redact_preserves_non_pii(self):
        detector = PIIDetector()
        text = "Name: John, Email: john@test.com"
        result = detector.scan(text)
        assert "Name: John" in result.redacted_text

    def test_redact_standalone(self):
        detector = PIIDetector()
        text = "SSN is 123-45-6789"
        redacted = detector.redact(text)
        assert "123-45-6789" not in redacted


class TestPIIScanResult:
    def test_scan_result_fields(self):
        detector = PIIDetector()
        result = detector.scan("Email: test@test.com, SSN: 123-45-6789")
        assert result.text_length > 0
        assert len(result.matches) > 0
        assert result.has_pii
        assert result.highest_severity is not None

    def test_empty_text(self):
        detector = PIIDetector()
        result = detector.scan("")
        assert not result.has_pii
        assert len(result.matches) == 0

    def test_no_pii_text(self):
        detector = PIIDetector()
        result = detector.scan("This is a clean text with no sensitive data")
        assert not result.has_pii


class TestPIIDetectorConfig:
    def test_custom_enabled_types(self):
        detector = PIIDetector(enabled_types={PIIType.EMAIL})
        result = detector.scan("Email: a@b.com, SSN: 123-45-6789")
        assert "email" in result.summary
        assert "ssn" not in result.summary

    def test_custom_redaction_char(self):
        detector = PIIDetector(redaction_char="X")
        result = detector.scan("Email: user@example.com")
        assert "XXXX" in result.redacted_text

    def test_custom_pattern(self):
        import re
        detector = PIIDetector(
            custom_patterns={"order_id": re.compile(r"ORD-\d{6}")}
        )
        result = detector.scan("Order: ORD-123456")
        assert result.has_pii

    def test_min_confidence_filter(self):
        detector = PIIDetector(min_confidence=0.99)
        result = detector.scan("Maybe phone: 555-1234")
        # High confidence threshold should filter out uncertain matches


class TestPIIScanDict:
    def test_scan_dict_values(self):
        detector = PIIDetector()
        data = {
            "name": "John Doe",
            "email": "john@example.com",
            "bio": "No PII here",
        }
        matches = detector.scan_dict(data)
        assert any(m.pii_type == PIIType.EMAIL for m in matches)

    def test_scan_nested_dict(self):
        detector = PIIDetector()
        data = {
            "user": {
                "contact": {
                    "email": "nested@example.com",
                }
            }
        }
        matches = detector.scan_dict(data)
        assert len(matches) > 0

    def test_scan_dict_with_lists(self):
        detector = PIIDetector()
        data = {
            "emails": ["a@test.com", "b@test.com"],
        }
        matches = detector.scan_dict(data)
        assert len(matches) >= 2
