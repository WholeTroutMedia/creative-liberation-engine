"""Advisory Council — Wisdom Archetype Agents

Six wisdom archetypes that provide strategic, philosophical, ethical,
and historical intelligence to the AVERI Trinity and Oracle Council.
These agents do not execute operational tasks — they advise.
"""

from typing import Dict, Any, List
from ..base_agent import BaseAgent
from cle_engine.core.agent_executor import AgentResult, AgentCapability


class _AdvisoryBase(BaseAgent):
    """Shared base for all Advisory Council agents."""

    def execute(self, context: Dict[str, Any]) -> AgentResult:
        task = context.get("task", {})
        task_type = task.get("type")

        if task_type == "advise":
            return AgentResult(success=True, output=self._advise(task, context))
        elif task_type == "reframe":
            return AgentResult(success=True, output=self._reframe(task, context))
        elif task_type == "challenge":
            return AgentResult(success=True, output=self._challenge(task, context))

        return AgentResult(success=True, output={"status": "success", "agent": self.name, "task_type": "general_advisory"})

    def _advise(self, task: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "success", "agent": self.name, "action": "advice_given",
                "domain": self.specialization, "perspective": self.name}

    def _reframe(self, task: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "success", "agent": self.name, "action": "problem_reframed",
                "original": task.get("problem", ""), "reframe": ""}

    def _challenge(self, task: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "success", "agent": self.name, "action": "assumption_challenged",
                "assumption": task.get("assumption", ""), "challenge": ""}

    def get_capabilities(self) -> List[str]:
        return [f"Strategic advisory ({self.specialization})",
                "Problem reframing", "Assumption challenging",
                "Historical pattern recognition", "Wisdom synthesis"]


class BUDDHAAgent(_AdvisoryBase):
    """Mindfulness, impermanence, and non-attachment advisory perspective."""
    def __init__(self):
        super().__init__(name="BUDDHA", agent_type="advisor",
            capabilities=[AgentCapability.ANALYSIS], hive="ADVISORY",
            specialization="mindfulness_philosophy",
            active_modes=["ideate", "plan", "ship", "validate"])
        self.activate()


class COSMOSAgent(_AdvisoryBase):
    """Systems thinking, long-horizon perspective, and cosmic scale reasoning."""
    def __init__(self):
        super().__init__(name="COSMOS", agent_type="advisor",
            capabilities=[AgentCapability.ANALYSIS], hive="ADVISORY",
            specialization="systems_cosmology",
            active_modes=["ideate", "plan"])
        self.activate()


class LEONARDOAgent(_AdvisoryBase):
    """Polymathic creativity, cross-domain synthesis, and Renaissance thinking."""
    def __init__(self):
        super().__init__(name="LEONARDO", agent_type="advisor",
            capabilities=[AgentCapability.ANALYSIS, AgentCapability.IMPLEMENTATION],
            hive="ADVISORY", specialization="polymathic_creativity",
            active_modes=["ideate", "plan", "ship"])
        self.activate()


class SAGEAgent(_AdvisoryBase):
    """Accumulated wisdom, pattern recognition across cycles, and timeless principles."""
    def __init__(self):
        super().__init__(name="SAGE", agent_type="advisor",
            capabilities=[AgentCapability.ANALYSIS], hive="ADVISORY",
            specialization="timeless_wisdom",
            active_modes=["ideate", "plan", "ship", "validate"])
        self.activate()


class SUN_TZUAgent(_AdvisoryBase):  # noqa: N801
    """Strategic advantage, competitive intelligence, and asymmetric positioning."""
    def __init__(self):
        super().__init__(name="SUN_TZU", agent_type="advisor",
            capabilities=[AgentCapability.ANALYSIS], hive="ADVISORY",
            specialization="strategic_warfare",
            active_modes=["ideate", "plan", "ship"])
        self.activate()


class WARREN_BUFFETTAgent(_AdvisoryBase):  # noqa: N801
    """Value investing, capital allocation, and long-term compounding intelligence."""
    def __init__(self):
        super().__init__(name="WARREN_BUFFETT", agent_type="advisor",
            capabilities=[AgentCapability.ANALYSIS], hive="ADVISORY",
            specialization="value_capital_allocation",
            active_modes=["ideate", "plan"])
        self.activate()
