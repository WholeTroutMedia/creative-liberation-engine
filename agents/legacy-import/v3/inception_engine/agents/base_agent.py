"""Base agent class for all AI agents."""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Base class for all AI agents."""
    
    def __init__(self, name: str, config: Optional[Dict[str, Any]] = None):
        """Initialize agent.
        
        Args:
            name: Agent name
            config: Agent configuration
        """
        self.name = name
        self.config = config or {}
        self.logger = logging.getLogger(f"agent.{name}")
    
    @abstractmethod
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute agent task.
        
        Args:
            context: Execution context
            
        Returns:
            Execution result
        """
        pass
    
    def validate_context(self, context: Dict[str, Any], required_keys: list) -> bool:
        """Validate execution context.
        
        Args:
            context: Context to validate
            required_keys: Required keys
            
        Returns:
            True if valid
        """
        missing = [k for k in required_keys if k not in context]
        if missing:
            self.logger.error(f"Missing required context keys: {missing}")
            return False
        return True
