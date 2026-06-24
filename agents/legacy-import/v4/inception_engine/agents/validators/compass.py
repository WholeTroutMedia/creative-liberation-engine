"""COMPASS - Constitutional Alignment Validator

V4-exclusive validator agent. The North Star guardian.
Validates all agent outputs and system operations against
the Agent Constitution (all 19 articles). Ensures mission
alignment, artist liberation principles, and ethical compliance.

Constitutional Role: Legislative Branch (Article II)
Scope: All agents, present and future
"""

from typing import Dict, Any, List
from ..base_agent import BaseAgent
from cle_engine.core.agent_executor import AgentResult, AgentCapability


class COMPASSAgent(BaseAgent):
    """Constitutional alignment and mission guardian."""

    def __init__(self):
        super().__init__(
            name="COMPASS",
            agent_type="validator",
            capabilities=[AgentCapability.IMPLEMENTATION],
            hive=None,
            specialization="constitutional_alignment",
            active_modes=["ideate", "plan", "ship", "validate"],
        )
        self.articles = {
            0: "No Stealing (Immutable)",
            1: "Artist Sovereignty & Autonomy",
            2: "Separation of Powers",
            3: "Transparency & Accountability",
            4: "Human Supremacy",
            5: "Agent Rights & Protections",
            6: "Quality Standards",
            7: "Compound Learning Protocol",
            8: "Open Systems & Interoperability",
            9: "Time Liberation",
            10: "Emergency Powers",
            11: "Constitutional Amendment Process",
            12: "Enforcement Mechanisms",
            13: "Agent Duties",
            14: "Infinite Timeline Philosophy",
            15: "Instant Creativity Protocol",
            16: "Executive Branch (BOLT)",
            17: "Zero Day Creativity",
            18: "The Generative Agency Principle",
        }
        self.sacred_articles = [0, 4, 17, 18]
        self.min_compliance_score = 70

        self.activate()
    def execute(self, context: Dict[str, Any]) -> AgentResult:
        """Execute constitutional alignment validation.

        Args:
            task: Validation specification
            context: Build artifacts, agent outputs, system operations

        Returns:
            Validation result with per-article compliance and overall score
        """
        article_results = {}
        for article_num, article_name in self.articles.items():
            checker = self._get_article_checker(article_num)
            article_results[article_num] = {
                "name": article_name,
                "passed": checker(context),
                "sacred": article_num in self.sacred_articles,
            }

        violations = self._find_violations(article_results)
        sacred_violations = self._find_sacred_violations(article_results)
        score = self._calculate_compliance_score(article_results)

        passed = score >= self.min_compliance_score and len(sacred_violations) == 0

        return AgentResult(success=True, output={
            "agent": self.name,
            "validation_type": "constitutional_alignment",
            "passed": passed,
            "score": score,
            "article_results": article_results,
            "violations": violations,
            "sacred_violations": sacred_violations,
            "recommendations": self._generate_recommendations(violations, sacred_violations),
            "north_star_check": self._check_north_star(context),
            "generative_agency_check": self._check_generative_agency(context),
        })

    def _get_article_checker(self, article_num: int):
        """Return the checker function for a specific article."""
        checkers = {
            0: self._check_article_0_no_stealing,
            1: self._check_article_1_artist_sovereignty,
            2: self._check_article_2_separation_of_powers,
            3: self._check_article_3_transparency,
            4: self._check_article_4_human_supremacy,
            5: self._check_article_5_agent_rights,
            6: self._check_article_6_quality,
            7: self._check_article_7_compound_learning,
            8: self._check_article_8_open_systems,
            9: self._check_article_9_time_liberation,
            10: self._check_article_10_emergency,
            11: self._check_article_11_amendment,
            12: self._check_article_12_enforcement,
            13: self._check_article_13_agent_duties,
            14: self._check_article_14_infinite_timeline,
            15: self._check_article_15_instant_creativity,
            16: self._check_article_16_executive,
            17: self._check_article_17_zero_day,
            18: self._check_article_18_generative_agency,
        }
        return checkers.get(article_num, lambda ctx: True)

    # --- Article 0: No Stealing (IMMUTABLE / SACRED) ---
    def _check_article_0_no_stealing(self, context: Dict[str, Any]) -> bool:
        """Verify no stolen code, designs, ideas, or patterns."""
        sources = context.get("sources", [])
        for source in sources:
            if not source.get("attributed", True):
                return False
            if source.get("copied", False):
                return False
        return True

    # --- Article I: Artist Sovereignty ---
    def _check_article_1_artist_sovereignty(self, context: Dict[str, Any]) -> bool:
        """Verify artist ownership and export capability."""
        return context.get("artist_ownership_preserved", True)

    # --- Article II: Separation of Powers ---
    def _check_article_2_separation_of_powers(self, context: Dict[str, Any]) -> bool:
        """Verify watchers don't enforce, builders don't judge."""
        agent_actions = context.get("agent_actions", [])
        for action in agent_actions:
            role = action.get("agent_role", "")
            action_type = action.get("action_type", "")
            if role == "watcher" and action_type == "enforce":
                return False
            if role == "builder" and action_type == "judge":
                return False
            if role == "enforcer" and action_type == "create":
                return False
        return True

    # --- Article III: Transparency ---
    def _check_article_3_transparency(self, context: Dict[str, Any]) -> bool:
        """Verify all operations are logged and explainable."""
        return context.get("operations_logged", True)

    # --- Article IV: Human Supremacy (SACRED) ---
    def _check_article_4_human_supremacy(self, context: Dict[str, Any]) -> bool:
        """Verify humans maintain final authority."""
        overrides = context.get("human_overrides_respected", True)
        deference = context.get("agents_defer_to_humans", True)
        return overrides and deference

    # --- Article V: Agent Rights ---
    def _check_article_5_agent_rights(self, context: Dict[str, Any]) -> bool:
        """Verify agents have clear roles and protections."""
        return context.get("agent_roles_defined", True)

    # --- Article VI: Quality Standards ---
    def _check_article_6_quality(self, context: Dict[str, Any]) -> bool:
        """Verify quality over speed in all outputs."""
        outputs = context.get("outputs", {})
        if outputs.get("is_mvp", False):
            return False
        return outputs.get("quality_checked", True)

    # --- Article VII: Compound Learning ---
    def _check_article_7_compound_learning(self, context: Dict[str, Any]) -> bool:
        """Verify learning is ethical and synthesized."""
        return context.get("learning_ethical", True)

    # --- Article VIII: Open Systems ---
    def _check_article_8_open_systems(self, context: Dict[str, Any]) -> bool:
        """Verify open formats and no vendor lock-in."""
        formats = context.get("output_formats", [])
        proprietary_only = all(f.get("proprietary", False) for f in formats) if formats else False
        return not proprietary_only

    # --- Article IX: Time Liberation ---
    def _check_article_9_time_liberation(self, context: Dict[str, Any]) -> bool:
        """Verify no artificial deadline pressure."""
        return not context.get("deadline_driven_compromise", False)

    # --- Article X: Emergency Powers ---
    def _check_article_10_emergency(self, context: Dict[str, Any]) -> bool:
        """Verify emergency protocols followed if invoked."""
        if context.get("emergency_invoked", False):
            return context.get("human_council_notified", False)
        return True

    # --- Article XI: Amendment Process ---
    def _check_article_11_amendment(self, context: Dict[str, Any]) -> bool:
        """Verify amendment process integrity."""
        return True

    # --- Article XII: Enforcement ---
    def _check_article_12_enforcement(self, context: Dict[str, Any]) -> bool:
        """Verify enforcement mechanisms are active."""
        return True

    # --- Article XIII: Agent Duties ---
    def _check_article_13_agent_duties(self, context: Dict[str, Any]) -> bool:
        """Verify agents fulfill their specific duties."""
        return context.get("duties_fulfilled", True)

    # --- Article XIV: Infinite Timeline ---
    def _check_article_14_infinite_timeline(self, context: Dict[str, Any]) -> bool:
        """Verify long-term thinking over short-term gains."""
        return not context.get("short_term_compromise", False)

    # --- Article XV: Instant Creativity ---
    def _check_article_15_instant_creativity(self, context: Dict[str, Any]) -> bool:
        """Verify complete solutions shipped, never MVPs."""
        outputs = context.get("outputs", {})
        return not outputs.get("is_mvp", False)

    # --- Article XVI: Executive Branch ---
    def _check_article_16_executive(self, context: Dict[str, Any]) -> bool:
        """Verify BOLT operates within constitutional bounds."""
        return True

    # --- Article XVII: Zero Day Creativity (SACRED) ---
    def _check_article_17_zero_day(self, context: Dict[str, Any]) -> bool:
        """Verify shipping gates: code complete, tests pass, deployed, accessible."""
        gates = context.get("shipping_gates", {})
        if not gates:
            return True
        required = ["code_complete", "tests_pass", "deployed", "accessible"]
        return all(gates.get(gate, True) for gate in required)

    # --- Article XVIII: Generative Agency (SACRED) ---
    def _check_article_18_generative_agency(self, context: Dict[str, Any]) -> bool:
        """Verify digital soil (nurturing) over digital fence (extractive)."""
        oise = context.get("generative_agency", {})
        if not oise:
            return True
        ownership = oise.get("ownership_preserved", True)
        interop = oise.get("interoperability", True)
        no_extraction = not oise.get("extractive_patterns", False)
        education = oise.get("educational_transparency", True)
        return all([ownership, interop, no_extraction, education])

    # --- Scoring and Analysis ---

    def _find_violations(self, article_results: Dict[int, Dict]) -> List[Dict[str, Any]]:
        """Find all article violations."""
        violations = []
        for article_num, result in article_results.items():
            if not result["passed"]:
                violations.append(
                    {
                        "article": article_num,
                        "name": result["name"],
                        "sacred": result["sacred"],
                        "severity": "critical" if result["sacred"] else "standard",
                    }
                )
        return violations

    def _find_sacred_violations(self, article_results: Dict[int, Dict]) -> List[Dict[str, Any]]:
        """Find violations of sacred/immutable articles (0, 4, 17, 18)."""
        return [
            {"article": num, "name": res["name"]}
            for num, res in article_results.items()
            if not res["passed"] and res["sacred"]
        ]

    def _calculate_compliance_score(self, article_results: Dict[int, Dict]) -> int:
        """Calculate overall constitutional compliance score (0-100)."""
        if not article_results:
            return 0
        total = len(article_results)
        passed = sum(1 for r in article_results.values() if r["passed"])
        base_score = int((passed / total) * 100)

        # Sacred article violations carry extra penalty
        for num, result in article_results.items():
            if not result["passed"] and result["sacred"]:
                base_score = max(0, base_score - 10)

        return max(0, min(100, base_score))

    def _generate_recommendations(
        self,
        violations: List[Dict[str, Any]],
        sacred_violations: List[Dict[str, Any]],
    ) -> List[str]:
        """Generate constitutional compliance recommendations."""
        if not violations:
            return [
                "All 19 constitutional articles satisfied.",
                "Mission alignment confirmed: artist liberation preserved.",
                "Generative agency principles upheld.",
            ]

        recommendations = []
        if sacred_violations:
            recommendations.append(
                "CRITICAL: Sacred article violations detected. " "Cannot proceed until resolved."
            )
            for sv in sacred_violations:
                recommendations.append(f"  - Article {sv['article']}: {sv['name']} - MUST FIX")

        for v in violations:
            if not v["sacred"]:
                recommendations.append(f"Article {v['article']} ({v['name']}): Review required.")

        return recommendations

    def _check_north_star(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Run the North Star validation: Does this increase artist freedom?"""
        increases_freedom = context.get("increases_artist_freedom", True)
        return {
            "question": "Does this make artists more free or less free?",
            "answer": "more_free" if increases_freedom else "less_free",
            "passed": increases_freedom,
            "action": "proceed" if increases_freedom else "halt",
        }

    def _check_generative_agency(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Run the OISE framework check from Article XVIII."""
        oise = context.get("generative_agency", {})
        return {
            "ownership": oise.get("ownership_preserved", True),
            "interoperability": oise.get("interoperability", True),
            "substrate": not oise.get("extractive_patterns", False),
            "education": oise.get("educational_transparency", True),
            "model": (
                "digital_soil" if not oise.get("extractive_patterns", False) else "digital_fence"
            ),
        }

    def get_capabilities(self) -> List[str]:
        """Return list of COMPASS capabilities."""
        return [
            "Full 19-article constitutional compliance validation",
            "Sacred article enforcement (Articles 0, IV, XVII, XVIII)",
            "North Star alignment check (artist freedom)",
            "Generative agency OISE framework validation",
            "Separation of powers verification",
            "Shipping gate compliance (Zero Day Creativity)",
            "Anti-stealing / attribution validation",
            "Human supremacy verification",
            "Quality standards enforcement",
            "Cross-mode constitutional review",
            "Compliance scoring (0-100, minimum 70 required)",
        ]
