"""
PRISM Agent — AI Model Operations & Service Health
===================================================
v5 new agent in SWITCHBOARD hive.
Autonomously polls all GENESIS services, tracks costs,
and routes health alerts to the Console feed.

This is the PRIMARY autonomous agent — triggered every 5 minutes
by the scheduler without any human input.
"""

import logging
import os
from typing import Any, Dict, List

import httpx

from cle_engine.agents.base_agent import BaseAgent
from cle_engine.core.agent_executor import AgentCapability, AgentResult

logger = logging.getLogger("agent.PRISM")

# Service map: name → health endpoint
GENESIS_SERVICES = {
    "genkit":         os.getenv("GENKIT_URL",       "http://genkit:4000")        + "/health",
    "agent-api":      os.getenv("AGENT_API_URL",    "http://agent-api:5001")     + "/health",
    "agent-triggers": os.getenv("TRIGGERS_URL",     "http://agent-triggers:5002") + "/health",
    "zero-day":       os.getenv("ZERO_DAY_URL",     "http://zero-day:3001")      + "/health",
    "ghost":          os.getenv("GHOST_URL",         "http://ghost:3002")         + "/health",
    "gateway":        os.getenv("GATEWAY_URL",       "http://gateway:80")         + "/health",
    "chromadb":       os.getenv("CHROMADB_URL",      "http://chromadb:8000")      + "/api/v1/heartbeat",
    "redis":          os.getenv("REDIS_URL",         "http://redis:6379")         + "/ping",
    "console":        os.getenv("CONSOLE_URL",       "http://console:3000")       + "/health",
}


class PRISMAgent(BaseAgent):
    """
    PRISM — AI Model Operations & Service Health Monitor.

    Autonomously polls all GENESIS microservices and emits structured
    health reports for the Console dashboard. Triggers SWITCHBOARD alerts
    on degraded or down services.

    Active in: all modes (autonomous, always on).
    """

    def __init__(self):
        super().__init__(
            name="PRISM",
            agent_type="builder",
            capabilities=[AgentCapability.VALIDATION, AgentCapability.COORDINATION],
            hive="SWITCHBOARD",
            specialization="ai_model_ops_health",
            active_modes=["ideate", "plan", "ship", "validate"],
        )
        self.activate()

    # ------------------------------------------------------------------ #

    def execute(self, context: Dict[str, Any]) -> AgentResult:
        """Execute PRISM task based on task type."""
        import asyncio

        task = context.get("task", {})
        task_type = task.get("type", "health_check")

        try:
            if task_type == "health_check":
                output = asyncio.run(self._run_health_check(task, context))
            else:
                output = {"status": "unknown_task", "task_type": task_type}

            return AgentResult(
                success=True,
                output=output,
                metadata={"agent": self.agent_name, "task_type": task_type},
            )
        except Exception as exc:
            self.logger.error(f"PRISM execution error: {exc}", exc_info=True)
            return AgentResult(
                success=False,
                output={},
                error=str(exc),
                metadata={"agent": self.agent_name},
            )

    # ------------------------------------------------------------------ #

    async def _run_health_check(
        self, task: Dict[str, Any], context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Poll all requested services and return structured health report."""

        requested = task.get("services", list(GENESIS_SERVICES.keys()))
        services_to_check = {
            name: url
            for name, url in GENESIS_SERVICES.items()
            if name in requested
        }

        results: List[Dict[str, Any]] = []
        alerts: List[Dict[str, Any]] = []

        async with httpx.AsyncClient(timeout=5) as client:
            for name, url in services_to_check.items():
                try:
                    resp = await client.get(url)
                    healthy = resp.status_code < 400
                    entry = {
                        "service": name,
                        "status": "healthy" if healthy else "degraded",
                        "status_code": resp.status_code,
                        "url": url,
                    }
                    if not healthy:
                        alerts.append({
                            "service": name,
                            "severity": "high",
                            "message": f"{name} returned HTTP {resp.status_code}",
                        })
                except httpx.ConnectError:
                    entry = {
                        "service": name,
                        "status": "down",
                        "error": "Connection refused",
                        "url": url,
                    }
                    alerts.append({
                        "service": name,
                        "severity": "critical",
                        "message": f"{name} is unreachable (connection refused)",
                    })
                except httpx.TimeoutException:
                    entry = {
                        "service": name,
                        "status": "timeout",
                        "error": "Request timed out",
                        "url": url,
                    }
                    alerts.append({
                        "service": name,
                        "severity": "high",
                        "message": f"{name} timed out",
                    })
                except Exception as exc:
                    entry = {
                        "service": name,
                        "status": "error",
                        "error": str(exc),
                        "url": url,
                    }

                results.append(entry)
                status_icon = "✅" if entry["status"] == "healthy" else "❌"
                self.logger.info(f"  {status_icon} {name}: {entry['status']}")

        healthy_count = sum(1 for r in results if r["status"] == "healthy")
        overall = "healthy" if not alerts else ("degraded" if healthy_count > 0 else "down")

        return {
            "overall": overall,
            "checked": len(results),
            "healthy": healthy_count,
            "degraded": len(results) - healthy_count,
            "has_alerts": len(alerts) > 0,
            "alerts": alerts,
            "services": results,
        }

    def validate_input(self, context: Dict[str, Any]) -> bool:
        """PRISM bypasses mode restriction — runs in any mode."""
        return self.active
