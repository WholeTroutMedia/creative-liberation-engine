#!/usr/bin/env python3
"""
Base Agent Class

[ZERO DAY UPDATE] Now inherits from AgentExecutor standard interface.
All agents (builders, validators, strategists, hive leaders) inherit from this.

Backward Compatible: Old agents still work, new agents get retry logic + metrics.
"""

from abc import abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import logging

# [ZERO DAY] Import new executor interface
from cle_engine.core.agent_executor import (
    AgentExecutor, 
    AgentResult, 
    AgentCapability
)

logger = logging.getLogger(__name__)


@dataclass
class AgentCapabilities:
    """Agent capabilities and metadata (LEGACY - for backward compat)"""
    name: str
    type: str  # builder, validator, leader, hive_leader
    hive: Optional[str]
    specialties: List[str]
    modes: List[str]  # Modes this agent participates in


class BaseAgent(AgentExecutor):
    """
    Base class for all Creative Liberation Engine agents.
    
    [ZERO DAY] Now inherits from AgentExecutor for standardized orchestration.
    
    All agents must implement:
    - execute() method returning AgentResult
    - validate_input() for context validation
    - get_capabilities() describing their abilities
    
    Constitutional Compliance:
    All agents are bound by the Agent Constitution and must
    pass constitutional checks before execution.
    """

    def __init__(
        self,
        name: str,
        agent_type: str,
        capabilities: List[AgentCapability],
        hive: Optional[str] = None,
        specialization: Optional[str] = None,
        active_modes: Optional[List[str]] = None,
    ):
        # Initialize parent AgentExecutor
        super().__init__(agent_name=name, capabilities=capabilities)
        
        # Agent-specific attributes
        self.agent_type = agent_type
        self.hive = hive
        self.specialization = specialization
        self.active_modes = active_modes or []
        self.active = False
        self.logger = logging.getLogger(f"agent.{name}")

    @abstractmethod
    def execute(self, context: Dict[str, Any]) -> AgentResult:
        """
        Execute agent's primary function.
        
        [ZERO DAY] Now returns AgentResult instead of raw dict.
        
        Args:
            context: Execution context from ContextManager including:
                - mode: Current mode (ideate/plan/ship/validate)
                - from_previous_mode: Structured output from previous mode
                - global_rules: Constitution, profile, design system

        Returns:
            AgentResult with success status, output dict, and metadata
        """
        pass

    def validate_input(self, context: Dict[str, Any]) -> bool:
        """
        Validate context before execution.
        
        Override in subclasses for custom validation.
        
        Args:
            context: Context dict to validate
        
        Returns:
            True if valid, False otherwise
        """
        # Basic validation
        required_keys = ["mode", "global_rules"]
        
        for key in required_keys:
            if key not in context:
                self.logger.error(f"Missing required context key: {key}")
                return False
        
        # Check if agent is active
        if not self.active:
            self.logger.warning(f"Agent {self.agent_name} not active")
            return False
        
        # Check if agent supports current mode
        current_mode = context.get("mode")
        if self.active_modes and current_mode not in self.active_modes:
            self.logger.warning(f"Agent {self.agent_name} not configured for mode: {current_mode}")
            return False
        
        return True

    def get_capabilities(self) -> Dict[str, Any]:
        """
        Return agent capabilities metadata.
        
        Returns:
            Dict with agent info, capabilities, modes, etc.
        """
        return {
            "name": self.agent_name,
            "type": self.agent_type,
            "hive": self.hive,
            "specialization": self.specialization,
            "capabilities": [c.value for c in self.capabilities],
            "modes": self.active_modes,
            "active": self.active,
            "execution_count": self.execution_count,
            "description": self.__doc__ or f"{self.agent_name} agent"
        }

    def activate(self):
        """Activate agent for execution."""
        self.active = True
        self.logger.info(f"✅ Agent {self.agent_name} activated")

    def deactivate(self):
        """Deactivate agent."""
        self.active = False
        self.logger.info(f"❌ Agent {self.agent_name} deactivated")

    def pre_execution_check(self, context: Dict[str, Any]) -> bool:
        """
        Run pre-execution validation (LEGACY wrapper for validate_input).
        
        Returns:
            True if agent can proceed with execution
        """
        return self.validate_input(context)

    def post_execution_hook(self, result: AgentResult):
        """
        Hook called after execution.
        
        Override in subclasses for custom post-processing.
        
        Args:
            result: AgentResult from execution
        """
        self.logger.info(
            f"🏁 Agent {self.agent_name} completed execution #{self.execution_count} "
            f"(success={result.success}, time={result.execution_time_ms}ms)"
        )

    # LEGACY COMPATIBILITY METHODS
    # These allow old agents to work without modification
    
    def execute_legacy(self, task: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        LEGACY: Old execute signature for backward compatibility.
        
        Args:
            task: Task specification (DEPRECATED - use context instead)
            context: Execution context
        
        Returns:
            Dictionary with execution results
        """
        self.logger.warning(
            f"Agent {self.agent_name} using LEGACY execute signature. "
            "Update to new execute(context) -> AgentResult signature."
        )
        
        # Merge task into context for new signature
        merged_context = {**context, "task": task}
        
        # Call new execute method
        result = self.execute(merged_context)
        
        # Return just the output dict for backward compat
        return result.output if result.success else {"error": result.error}
    
    def get_capabilities_legacy(self) -> List[str]:
        """
        LEGACY: Return capabilities as list of strings.
        
        Returns:
            List of capability names
        """
        caps = self.get_capabilities()
        return caps.get("capabilities", [])


# Example migration for existing agents
class MigrationExample(BaseAgent):
    """
    Example showing how to migrate an existing agent to new interface.
    
    OLD WAY:
    ```python
    def execute(self, task, context):
        return {"output": "result"}
    ```
    
    NEW WAY:
    ```python
    def execute(self, context):
        return AgentResult(
            success=True,
            output={"output": "result"},
            metadata={"agent": self.agent_name}
        )
    ```
    """
    
    def __init__(self):
        super().__init__(
            name="example",
            agent_type="builder",
            capabilities=[AgentCapability.IMPLEMENTATION],
            active_modes=["ship"]
        )
        self.activate()
    
    def execute(self, context: Dict[str, Any]) -> AgentResult:
        """New execute signature."""
        try:
            mode = context.get("mode")
            
            # Do agent work
            output = {
                "message": f"Example agent executed in {mode} mode",
                "processed_keys": list(context.keys())
            }
            
            return AgentResult(
                success=True,
                output=output,
                metadata={"mode": mode}
            )
            
        except Exception as e:
            self.logger.error(f"Execution failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                output={},
                error=str(e)
            )


if __name__ == "__main__":
    # Test the migration example
    agent = MigrationExample()
    
    test_context = {
        "mode": "ship",
        "global_rules": {"constitution": "..."},
        "from_previous_mode": {}
    }
    
    print("\n" + "="*70)
    print("TEST: BaseAgent with AgentExecutor Interface")
    print("="*70)
    
    # Test with retry logic
    result = agent.execute_with_retry(test_context)
    
    print(f"\nSuccess: {result.success}")
    print(f"Output: {result.output}")
    print(f"Execution time: {result.execution_time_ms}ms")
    print(f"\nCapabilities: {agent.get_capabilities()}")
    print(f"Metrics: {agent.get_metrics()}")
    print("\n✅ BaseAgent migration complete!")
