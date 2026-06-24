"""IRIS - Swift Action & Blocker Removal Leader Agent

Part of AVERI core. Rapid execution, blocker removal,
and decisive action in critical moments.
"""

from typing import Dict, Any, List
from ..base_agent import BaseAgent
from cle_engine.core.agent_executor import AgentResult, AgentCapability


class IRISAgent(BaseAgent):
    """Swift action and blocker removal leader."""

    def __init__(self):
        super().__init__(
            name="IRIS",
            agent_type="leader",
            capabilities=[AgentCapability.IMPLEMENTATION],
            hive=None,
            specialization="action_blockers",
            active_modes=["ideate", "plan", "ship"],
            compressible=True,
        )

        self.activate()
    def execute(self, context: Dict[str, Any]) -> AgentResult:
        """Execute swift action and blocker removal tasks."""
        task = context.get("task", {})
        task_type = task.get("type")
        if task_type == "blocker":
            return AgentResult(success=True, output=self._remove_blocker(task, context))
        elif task_type == "rapid_action":
            return AgentResult(success=True, output=self._rapid_action(task, context))
        elif task_type == "escalation":
            return AgentResult(success=True, output=self._handle_escalation(task, context))
        else:
            return AgentResult(success=True, output=self._decisive_action(task, context))

    def _remove_blocker(self, task, context):
        return {"status": "success", "agent": self.name, "task_type": "blocker_removal"}

    def _rapid_action(self, task, context):
        return {"status": "success", "agent": self.name, "task_type": "rapid_action"}

    def _handle_escalation(self, task, context):
        return {"status": "success", "agent": self.name, "task_type": "escalation"}

    def _decisive_action(self, task, context):
        return {"status": "success", "agent": self.name, "task_type": "decisive_action"}

    def get_capabilities(self) -> List[str]:
        return [
            "Blocker removal",
            "Rapid execution",
            "Escalation handling",
            "Critical decision making",
            "Momentum maintenance",
            "Priority enforcement",
        ]
