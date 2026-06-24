"""Windsurf IDE Adapter

Generates Windsurf-specific configuration (similar to Cursor).

Created: 2026-02-14
Author: SWITCHBOARD (routing)
"""

from pathlib import Path
from typing import Dict, Any
from .cursor_adapter import CursorAdapter


class WindsurfAdapter(CursorAdapter):
    """Adapter for Windsurf IDE (extends Cursor adapter)."""
    
    def generate_config(self, project_path: Path, project_dna: Dict[str, Any]) -> Dict[str, Any]:
        """Generate Windsurf configuration (reuses Cursor logic)."""
        result = super().generate_config(project_path, project_dna)
        
        # Update paths for Windsurf
        adapter_path = project_path / ".adapters" / "windsurf"
        adapter_path.mkdir(parents=True, exist_ok=True)
        
        # Copy Cursor files to Windsurf directory
        cursor_path = project_path / ".adapters" / "cursor"
        if cursor_path.exists():
            import shutil
            for file in cursor_path.iterdir():
                if file.is_file():
                    shutil.copy(file, adapter_path / file.name)
        
        result["platform"] = "windsurf"
        return result
    
    def _generate_readme(self) -> str:
        """Generate Windsurf README."""
        return """# Windsurf IDE Setup

## Installation

1. Download Windsurf IDE
2. Install and open Windsurf

## Project Setup

1. Copy `.windsurfrules` to project root:
   ```bash
   cp .adapters/windsurf/.cursorrules .windsurfrules
   ```

2. Open this project in Windsurf

## Features

Same as Cursor with Windsurf-specific optimizations.
"""
