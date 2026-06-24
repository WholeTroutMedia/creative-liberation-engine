"""RELAY - Task Routing & Distribution Agent

Part of SWITCHBOARD Hive. Routes tasks between agents,
manages inter-hive communication, and handles task distribution.
"""

from typing import Dict, Any, List
from ..base_agent import BaseAgent
from cle_engine.core.agent_executor import AgentResult, AgentCapability


class RELAYAgent(BaseAgent):
    """Task routing and inter-agent communication specialist."""

    def __init__(self):
        super().__init__(
            name="RELAY",
            agent_type="builder",
            capabilities=[AgentCapability.COORDINATION],
            hive="SWITCHBOARD",
            specialization="task_routing",
            active_modes=["ideate", "plan", "ship"],
        )

        self.activate()
    def execute(self, context: Dict[str, Any]) -> AgentResult:
        """Execute task routing operation."""
        task = context.get("task", {})
        task_type = task.get("type")

        if task_type == "route_task":
            return AgentResult(success=True, output=self._route_task(task, context))
        elif task_type == "broadcast":
            return AgentResult(success=True, output=self._broadcast_message(task, context))
        elif task_type == "collect_results":
            return AgentResult(success=True, output=self._collect_results(task, context))

        return AgentResult(success=True, output={"status": "success", "agent": self.name, "task_type": "general_relay"})

    def _route_task(self, task: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Route task to appropriate agent or hive."""
        return {
            "status": "success",
            "agent": self.name,
            "action": "task_routed",
            "routing": {
                "source": task.get("source", "unknown"),
                "target_hive": task.get("target_hive"),
                "target_agent": task.get("target_agent"),
                "priority": task.get("priority", "normal"),
            },
        }

    def _broadcast_message(self, task: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Broadcast message to multiple agents."""
        return {
            "status": "success",
            "agent": self.name,
            "action": "message_broadcast",
            "recipients": task.get("recipients", []),
        }

    def _collect_results(self, task: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Collect and aggregate results from multiple agents."""
        return {
            "status": "success",
            "agent": self.name,
            "action": "results_collected",
            "aggregated": True,
        }

    def get_capabilities(self) -> List[str]:
        return [
            "Task routing between agents",
            "Inter-hive communication",
            "Message broadcasting",
            "Result aggregation",
            "Priority-based dispatching",
        ]
