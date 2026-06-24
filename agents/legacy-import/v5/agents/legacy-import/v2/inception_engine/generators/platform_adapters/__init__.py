"""Platform Adapters for Universal Project DNA

Each adapter translates Universal Project DNA into platform-specific configurations.

Available Adapters:
- VertexAIAdapter: Google Vertex AI Studio (Drive sync)
- FirebaseAdapter: Firebase deployment
- CursorAdapter: Cursor IDE (MCP)
- WindsurfAdapter: Windsurf IDE (MCP)
- ClaudeProjectsAdapter: Claude Projects
- BoltAdapter: Bolt.new instant deploy
- ReplitAdapter: Replit IDE
- OllamaAdapter: Local Ollama models

Created: 2026-02-14
Authors: SWITCHBOARD (routing), RELAY (communication), RAM_CREW (validation)
"""

from .base_adapter import BaseAdapter
from .vertex_ai_adapter import VertexAIAdapter
from .firebase_adapter import FirebaseAdapter
from .cursor_adapter import CursorAdapter
from .windsurf_adapter import WindsurfAdapter
from .claude_projects_adapter import ClaudeProjectsAdapter
from .bolt_adapter import BoltAdapter
from .replit_adapter import ReplitAdapter
from .ollama_adapter import OllamaAdapter

__all__ = [
    "BaseAdapter",
    "VertexAIAdapter",
    "FirebaseAdapter",
    "CursorAdapter",
    "WindsurfAdapter",
    "ClaudeProjectsAdapter",
    "BoltAdapter",
    "ReplitAdapter",
    "OllamaAdapter",
]

# Adapter registry
ADAPTER_REGISTRY = {
    "vertex-ai": VertexAIAdapter,
    "firebase": FirebaseAdapter,
    "cursor": CursorAdapter,
    "windsurf": WindsurfAdapter,
    "claude-projects": ClaudeProjectsAdapter,
    "bolt": BoltAdapter,
    "replit": ReplitAdapter,
    "ollama": OllamaAdapter,
}


def get_adapter(platform: str) -> BaseAdapter:
    """Get adapter instance for platform."""
    adapter_class = ADAPTER_REGISTRY.get(platform)
    if not adapter_class:
        raise ValueError(f"Unknown platform: {platform}")
    return adapter_class()
