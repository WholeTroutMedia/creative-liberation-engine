"""
FORGE Agent — Infrastructure & Container Operations
====================================================
v5 new agent in SWITCHBOARD hive.
Owns the GENESIS Docker stack — validates deployments,
runs smoke tests, and marks deploys green/red in the Console.

Triggered autonomously by the Forgejo webhook receiver on
protected-branch pushes or CI success events.
"""

import logging
import os
from typing import Any, Dict

import httpx

from cle_engine.agents.base_agent import BaseAgent
from cle_engine.core.agent_executor import AgentCapability, AgentResult

logger = logging.getLogger("agent.FORGE")

GENKIT_URL   = os.getenv("GENKIT_URL",    "http://genkit:4000")
AGENT_API_URL = os.getenv("AGENT_API_URL", "http://agent-api:5001")


class FORGEAgent(BaseAgent):
    """
    FORGE — Infrastructure & Container Operations.

    Validates deployments, executes post-deploy smoke tests,
    and owns the GENESIS Docker stack lifecycle.

    Active in: ship mode.
    """

    def __init__(self):
        super().__init__(
            name="FORGE",
            agent_type="builder",
            capabilities=[AgentCapability.IMPLEMENTATION, AgentCapability.VALIDATION],
            hive="SWITCHBOARD",
            specialization="infrastructure_container_ops",
            active_modes=["ship"],
        )
        self.activate()

    def execute(self, context: Dict[str, Any]) -> AgentResult:
        """Execute FORGE task based on task type."""
        import asyncio

        task = context.get("task", {})
        task_type = task.get("type", "deploy_validation")

        try:
            if task_type in ("deploy_validation", "ci_success_deploy"):
                output = asyncio.run(self._validate_deploy(task))
            else:
                output = {"status": "unknown_task", "task_type": task_type}

            return AgentResult(
                success=True,
                output=output,
                metadata={"agent": self.agent_name, "task_type": task_type},
            )
        except Exception as exc:
            self.logger.error(f"FORGE execution error: {exc}", exc_info=True)
            return AgentResult(
                success=False,
                output={},
                error=str(exc),
                metadata={"agent": self.agent_name},
            )

    async def _validate_deploy(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Run post-deploy smoke tests against key GENESIS endpoints."""
        repo        = task.get("repo", "unknown")
        branch      = task.get("branch", "main")
        commit_sha  = task.get("commit_sha", "")
        auto_deploy = task.get("auto_deploy", True)

        self.logger.info(
            f"[FORGE] Validating deploy: {repo}@{branch} | commit={commit_sha}"
        )

        smoke_tests = [
            (GENKIT_URL + "/health",    "Genkit AI Runtime"),
            (AGENT_API_URL + "/health", "Agent API Bridge"),
        ]

        results = []
        passed = 0

        async with httpx.AsyncClient(timeout=10) as client:
            for url, label in smoke_tests:
                try:
                    resp = await client.get(url)
                    ok = resp.status_code < 400
                    results.append({"test": label, "url": url, "passed": ok, "status": resp.status_code})
                    if ok:
                        passed += 1
                        self.logger.info(f"  ✅ {label}: OK")
                    else:
                        self.logger.warning(f"  ❌ {label}: HTTP {resp.status_code}")
                except Exception as exc:
                    results.append({"test": label, "url": url, "passed": False, "error": str(exc)})
                    self.logger.error(f"  ❌ {label}: {exc}")

        all_passed = passed == len(smoke_tests)
        deploy_status = "green" if all_passed else "red"

        return {
            "repo": repo,
            "branch": branch,
            "commit_sha": commit_sha,
            "deploy_status": deploy_status,
            "smoke_tests_run": len(smoke_tests),
            "smoke_tests_passed": passed,
            "smoke_tests": results,
            "auto_deploy": auto_deploy,
        }

    def validate_input(self, context: Dict[str, Any]) -> bool:
        return self.active
