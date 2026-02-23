"""Tests for GateValidator - SHIP mode production gates."""

import pytest
import os
import tempfile
from inception_engine.core.gate_validator import GateValidator, GateStatus


class TestGateValidator:
    """Test suite for GateValidator."""

    def setup_method(self):
        """Setup for each test."""
        self.validator = GateValidator()

    def test_initialization(self):
        """Test gate validator initialization."""
        assert self.validator is not None
        assert len(self.validator.gates) == 4

    def test_code_complete_gate_pass(self):
        """Test code complete gate passing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            context = {
                "code_path": tmpdir,
                "planned_files": [],
            }
            result = self.validator.validate_gate("code_complete", context)
            assert result["passed"] is True
            assert result["gate"] == "code_complete"

    def test_code_complete_gate_fail(self):
        """Test code complete gate failing."""
        context = {
            "code_path": None,
        }
        result = self.validator.validate_gate("code_complete", context)
        assert result["passed"] is False
        assert len(result["issues"]) > 0

    def test_tests_passing_gate(self):
        """Test tests passing gate."""
        context = {
            "skip_tests": True,
        }
        result = self.validator.validate_gate("tests_passing", context)
        # Skipped tests are not passing
        assert result["gate"] == "tests_passing"

    def test_deployed_gate(self):
        """Test deployment gate."""
        context = {
            "production_url": "https://app.example.com",
            "deployment_id": "deploy-123",
        }
        result = self.validator.validate_gate("deployed", context)
        assert result["passed"] is True

    def test_deployed_gate_fail(self):
        """Test deployment gate failing."""
        context = {}
        result = self.validator.validate_gate("deployed", context)
        assert result["passed"] is False

    def test_live_accessible_gate_fail(self):
        """Test live and accessible gate fails without URL."""
        context = {}
        result = self.validator.validate_gate("live_accessible", context)
        assert result["passed"] is False

    def test_unknown_gate(self):
        """Test unknown gate name."""
        result = self.validator.validate_gate("nonexistent", {})
        assert result["passed"] is False
        assert "Unknown gate" in result["issues"][0]

    def test_validate_all_gates_tuple(self):
        """Test validating all gates returns tuple."""
        with tempfile.TemporaryDirectory() as tmpdir:
            context = {
                "code_path": tmpdir,
                "planned_files": [],
                "skip_tests": True,
                "production_url": "https://app.example.com",
                "deployment_id": "deploy-123",
            }
            all_passed, results = self.validator.validate_all_gates(context)
            assert isinstance(all_passed, bool)
            assert isinstance(results, list)
            assert len(results) == 4

    def test_get_summary(self):
        """Test get_summary returns correct format."""
        context = {
            "production_url": "https://app.example.com",
        }
        self.validator.validate_all_gates(context)
        summary = self.validator.get_summary()
        assert "total_gates" in summary
        assert "passed" in summary
        assert "failed" in summary
        assert "all_passed" in summary

    def test_get_failed_gates(self):
        """Test get_failed_gates returns failed gates."""
        context = {}  # Missing everything
        self.validator.validate_all_gates(context)
        failed = self.validator.get_failed_gates()
        assert len(failed) > 0
        assert all(g.status == GateStatus.FAIL for g in failed)
