"""Base Adapter - Abstract base class for all platform adapters

Defines the interface that all platform adapters must implement.

Created: 2026-02-14
Author: SWITCHBOARD (routing architecture)
"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any, List


class BaseAdapter(ABC):
    """Abstract base class for platform adapters."""
    
    def __init__(self):
        self.platform_name = self.__class__.__name__.replace("Adapter", "")
    
    @abstractmethod
    def generate_config(self, project_path: Path, project_dna: Dict[str, Any]) -> Dict[str, Any]:
        """Generate platform-specific configuration files.
        
        Args:
            project_path: Path to project root
            project_dna: Universal project DNA from .cle/manifest.json
            
        Returns:
            Dictionary with generated file paths and metadata
        """
        pass
    
    @abstractmethod
    def validate_compatibility(self, project_dna: Dict[str, Any]) -> Dict[str, Any]:
        """Validate project compatibility with this platform.
        
        Args:
            project_dna: Universal project DNA
            
        Returns:
            Validation result with warnings/errors
        """
        pass
    
    def get_setup_instructions(self) -> str:
        """Get platform-specific setup instructions.
        
        Returns:
            Markdown-formatted setup guide
        """
        return f"# {self.platform_name} Setup\n\nImplement setup instructions."
    
    def get_deploy_command(self) -> str:
        """Get deployment command for this platform.
        
        Returns:
            Shell command to deploy
        """
        return "echo 'Deploy command not implemented'"
