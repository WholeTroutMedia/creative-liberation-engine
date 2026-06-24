"""ReviewAgent implementation for code review tasks.

This agent specializes in reviewing code for quality, security,
performance, and best practices compliance.
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from enum import Enum
import logging

from orchestration.core.agent_base import AgentBase, AgentConfig
from orchestration.core.artifact_manager import ArtifactManager

logger = logging.getLogger(__name__)


class ReviewSeverity(Enum):
    """Severity levels for review findings."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class ReviewCategory(Enum):
    """Categories for review findings."""
    SECURITY = "security"
    PERFORMANCE = "performance"
    MAINTAINABILITY = "maintainability"
    CORRECTNESS = "correctness"
    STYLE = "style"
    DOCUMENTATION = "documentation"
    TESTING = "testing"


@dataclass
class ReviewFinding:
    """Represents a single review finding.
    
    Attributes:
        severity: Severity level of the finding
        category: Category of the issue
        message: Description of the finding
        file: File where the issue was found
        line: Line number (if applicable)
        suggestion: Suggested fix or improvement
    """
    severity: ReviewSeverity
    category: ReviewCategory
    message: str
    file: str
    line: Optional[int] = None
    suggestion: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert finding to dictionary."""
        return {
            "severity": self.severity.value,
            "category": self.category.value,
            "message": self.message,
            "file": self.file,
            "line": self.line,
            "suggestion": self.suggestion,
        }


class ReviewAgent(AgentBase):
    """Agent specialized in code review and quality analysis.
    
    The ReviewAgent handles tasks related to:
    - Security vulnerability detection
    - Performance analysis and suggestions
    - Code style and best practices
    - Documentation quality assessment
    - Test coverage analysis
    
    Attributes:
        review_rules: Configurable review rules
        severity_threshold: Minimum severity to report
    """
    
    DEFAULT_RULES = {
        "security": {
            "check_sql_injection": True,
            "check_xss": True,
            "check_hardcoded_secrets": True,
            "check_unsafe_deserialization": True,
        },
        "performance": {
            "check_n_plus_one": True,
            "check_memory_leaks": True,
            "check_inefficient_loops": True,
        },
        "style": {
            "check_naming_conventions": True,
            "check_line_length": True,
            "max_line_length": 100,
        },
    }
    
    def __init__(
        self,
        config: AgentConfig,
        artifact_manager: Optional[ArtifactManager] = None,
        review_rules: Optional[Dict[str, Any]] = None,
        severity_threshold: ReviewSeverity = ReviewSeverity.LOW,
    ):
        """Initialize the ReviewAgent.
        
        Args:
            config: Agent configuration
            artifact_manager: Artifact storage manager
            review_rules: Custom review rules configuration
            severity_threshold: Minimum severity level to include in results
        """
        super().__init__(config)
        self.artifact_manager = artifact_manager
        self.review_rules = review_rules or self.DEFAULT_RULES.copy()
        self.severity_threshold = severity_threshold
        self._findings: List[ReviewFinding] = []
        
    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a code review task.
        
        Args:
            task: Task specification containing:
                - files: List of files to review
                - categories: Categories to check (optional)
                - focus_areas: Specific areas to focus on (optional)
                
        Returns:
            Dict containing:
                - status: Success/failure status
                - findings: List of review findings
                - summary: Review summary statistics
                - recommendations: High-level recommendations
        """
        files = task.get("files", [])
        categories = task.get("categories", list(ReviewCategory))
        focus_areas = task.get("focus_areas", [])
        
        if not files:
            return {
                "status": "error",
                "error": "No files provided for review",
            }
        
        logger.info(f"ReviewAgent reviewing {len(files)} files")
        
        try:
            self._findings = []
            
            for file_info in files:
                await self._review_file(file_info, categories, focus_areas)
            
            # Filter by severity threshold
            filtered_findings = self._filter_by_severity()
            
            # Generate summary
            summary = self._generate_summary(filtered_findings)
            
            # Store review artifacts
            if self.artifact_manager:
                await self.artifact_manager.store(
                    artifact_type="review",
                    content=str(filtered_findings),
                    metadata={
                        "files_reviewed": len(files),
                        "findings_count": len(filtered_findings),
                    }
                )
            
            return {
                "status": "success",
                "findings": [f.to_dict() for f in filtered_findings],
                "summary": summary,
                "recommendations": self._generate_recommendations(filtered_findings),
            }
            
        except Exception as e:
            logger.error(f"ReviewAgent execution failed: {e}")
            return {
                "status": "error",
                "error": str(e),
            }
    
    async def _review_file(
        self,
        file_info: Dict[str, Any],
        categories: List[ReviewCategory],
        focus_areas: List[str],
    ) -> None:
        """Review a single file.
        
        Args:
            file_info: File information including content
            categories: Categories to check
            focus_areas: Specific areas to focus on
        """
        filename = file_info.get("filename", "unknown")
        content = file_info.get("content", "")
        
        if not content:
            return
        
        # Run category-specific checks
        if ReviewCategory.SECURITY in categories:
            await self._check_security(filename, content)
            
        if ReviewCategory.PERFORMANCE in categories:
            await self._check_performance(filename, content)
            
        if ReviewCategory.STYLE in categories:
            await self._check_style(filename, content)
            
        if ReviewCategory.DOCUMENTATION in categories:
            await self._check_documentation(filename, content)
    
    async def _check_security(self, filename: str, content: str) -> None:
        """Check for security issues."""
        rules = self.review_rules.get("security", {})
        
        # Check for hardcoded secrets
        if rules.get("check_hardcoded_secrets"):
            secret_patterns = ["password=", "api_key=", "secret=", "token="]
            for i, line in enumerate(content.split("\n"), 1):
                for pattern in secret_patterns:
                    if pattern in line.lower() and "=" in line:
                        self._findings.append(ReviewFinding(
                            severity=ReviewSeverity.CRITICAL,
                            category=ReviewCategory.SECURITY,
                            message=f"Potential hardcoded secret detected",
                            file=filename,
                            line=i,
                            suggestion="Move secrets to environment variables",
                        ))
        
        # Check for SQL injection patterns
        if rules.get("check_sql_injection"):
            if "f\"SELECT" in content or "f'SELECT" in content:
                self._findings.append(ReviewFinding(
                    severity=ReviewSeverity.HIGH,
                    category=ReviewCategory.SECURITY,
                    message="Potential SQL injection vulnerability",
                    file=filename,
                    suggestion="Use parameterized queries instead",
                ))
    
    async def _check_performance(self, filename: str, content: str) -> None:
        """Check for performance issues."""
        rules = self.review_rules.get("performance", {})
        
        # Check for inefficient patterns
        if rules.get("check_inefficient_loops"):
            if ".append(" in content and "for " in content:
                # Simple heuristic - could be enhanced
                if content.count("for ") > 2:
                    self._findings.append(ReviewFinding(
                        severity=ReviewSeverity.MEDIUM,
                        category=ReviewCategory.PERFORMANCE,
                        message="Multiple nested loops detected",
                        file=filename,
                        suggestion="Consider using list comprehensions or vectorized operations",
                    ))
    
    async def _check_style(self, filename: str, content: str) -> None:
        """Check for style issues."""
        rules = self.review_rules.get("style", {})
        max_length = rules.get("max_line_length", 100)
        
        if rules.get("check_line_length"):
            for i, line in enumerate(content.split("\n"), 1):
                if len(line) > max_length:
                    self._findings.append(ReviewFinding(
                        severity=ReviewSeverity.LOW,
                        category=ReviewCategory.STYLE,
                        message=f"Line exceeds {max_length} characters",
                        file=filename,
                        line=i,
                        suggestion="Break line into multiple lines",
                    ))
    
    async def _check_documentation(self, filename: str, content: str) -> None:
        """Check documentation quality."""
        # Check for missing docstrings
        if filename.endswith(".py"):
            if "def " in content and '"""' not in content:
                self._findings.append(ReviewFinding(
                    severity=ReviewSeverity.INFO,
                    category=ReviewCategory.DOCUMENTATION,
                    message="Functions found without docstrings",
                    file=filename,
                    suggestion="Add docstrings to all public functions",
                ))
    
    def _filter_by_severity(self) -> List[ReviewFinding]:
        """Filter findings by severity threshold."""
        severity_order = [
            ReviewSeverity.CRITICAL,
            ReviewSeverity.HIGH,
            ReviewSeverity.MEDIUM,
            ReviewSeverity.LOW,
            ReviewSeverity.INFO,
        ]
        threshold_index = severity_order.index(self.severity_threshold)
        allowed_severities = severity_order[:threshold_index + 1]
        
        return [f for f in self._findings if f.severity in allowed_severities]
    
    def _generate_summary(self, findings: List[ReviewFinding]) -> Dict[str, Any]:
        """Generate review summary."""
        summary = {
            "total_findings": len(findings),
            "by_severity": {},
            "by_category": {},
        }
        
        for severity in ReviewSeverity:
            count = len([f for f in findings if f.severity == severity])
            if count > 0:
                summary["by_severity"][severity.value] = count
        
        for category in ReviewCategory:
            count = len([f for f in findings if f.category == category])
            if count > 0:
                summary["by_category"][category.value] = count
        
        return summary
    
    def _generate_recommendations(self, findings: List[ReviewFinding]) -> List[str]:
        """Generate high-level recommendations."""
        recommendations = []
        
        critical_count = len([f for f in findings if f.severity == ReviewSeverity.CRITICAL])
        security_count = len([f for f in findings if f.category == ReviewCategory.SECURITY])
        
        if critical_count > 0:
            recommendations.append(
                f"Address {critical_count} critical issue(s) before merging"
            )
        
        if security_count > 0:
            recommendations.append(
                "Security review recommended before deployment"
            )
        
        if not recommendations:
            recommendations.append("Code looks good overall")
        
        return recommendations
    
    def set_severity_threshold(self, threshold: ReviewSeverity) -> None:
        """Set the severity threshold for filtering.
        
        Args:
            threshold: New severity threshold
        """
        self.severity_threshold = threshold
    
    def update_rules(self, rules: Dict[str, Any]) -> None:
        """Update review rules.
        
        Args:
            rules: New rules to merge with existing
        """
        for category, category_rules in rules.items():
            if category in self.review_rules:
                self.review_rules[category].update(category_rules)
            else:
                self.review_rules[category] = category_rules
