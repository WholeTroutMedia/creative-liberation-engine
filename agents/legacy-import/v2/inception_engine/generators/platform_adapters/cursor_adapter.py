"""Cursor IDE Adapter

Generates MCP (Model Context Protocol) configuration for Cursor IDE.

Created: 2026-02-14
Author: SWITCHBOARD (routing)
"""

import json
from pathlib import Path
from typing import Dict, Any
from .base_adapter import BaseAdapter


class CursorAdapter(BaseAdapter):
    """Adapter for Cursor IDE with MCP support."""
    
    def generate_config(self, project_path: Path, project_dna: Dict[str, Any]) -> Dict[str, Any]:
        """Generate Cursor IDE configuration."""
        adapter_path = project_path / ".adapters" / "cursor"
        adapter_path.mkdir(parents=True, exist_ok=True)
        
        # Generate .cursorrules
        cursorrules_path = adapter_path / ".cursorrules"
        with open(cursorrules_path, "w") as f:
            f.write(self._generate_cursorrules(project_dna))
        
        # Generate MCP config
        mcp_config_path = adapter_path / "mcp-config.json"
        mcp_config = self._generate_mcp_config(project_dna)
        with open(mcp_config_path, "w") as f:
            json.dump(mcp_config, f, indent=2)
        
        # Generate README
        readme_path = adapter_path / "README.md"
        with open(readme_path, "w") as f:
            f.write(self._generate_readme())
        
        return {
            "platform": "cursor",
            "files_generated": [
                str(cursorrules_path),
                str(mcp_config_path),
                str(readme_path),
            ],
            "mcp_enabled": True,
        }
    
    def validate_compatibility(self, project_dna: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Cursor compatibility."""
        return {
            "compatible": True,
            "mcp_required": True,
            "recommendations": ["Install Cursor IDE from cursor.sh"],
        }
    
    def _generate_cursorrules(self, project_dna: Dict) -> str:
        """Generate .cursorrules."""
        project_name = project_dna.get("name", "Project")
        constitution = project_dna.get("strategic_dna", {}).get("economics", {})
        
        return f"""# {project_name} - Creative Liberation Engine Project

This project follows Creative Liberation Engine constitutional principles.

## Core Principles

1. **Artist Revenue Share**: {constitution.get('artist_revenue_share', '50%')} always
2. **Human Augmentation**: AI assists, never replaces
3. **Regenerative Economics**: Sustainable, compound growth
4. **Zero-Day Velocity**: Ship fast, ship right

## Code Style

- Write clean, documented code
- Follow existing patterns in codebase
- Test before committing
- Document architectural decisions

## Constitutional Compliance

All code must:
- Respect artist ownership
- Maintain transparency
- Support ethical AI use
- Enable human agency

## Project DNA

See `.cle/manifest.json` for complete project DNA.
"""
    
    def _generate_mcp_config(self, project_dna: Dict) -> Dict:
        """Generate MCP configuration."""
        return {
            "mcpServers": {
                "cle-engine": {
                    "command": "npx",
                    "args": ["-y", "@cle/mcp-server"],
                    "env": {
                        "PROJECT_DNA": ".cle/manifest.json",
                        "CONSTITUTION": ".cle/constitution.json",
                    },
                }
            }
        }
    
    def _generate_readme(self) -> str:
        """Generate Cursor README."""
        return """# Cursor IDE Setup

## Installation

1. Download Cursor from [cursor.sh](https://cursor.sh)
2. Install and open Cursor

## Project Setup

1. Copy `.cursorrules` to project root:
   ```bash
   cp .adapters/cursor/.cursorrules .
   ```

2. Copy MCP config to Cursor settings:
   ```bash
   # macOS/Linux
   cp .adapters/cursor/mcp-config.json ~/.cursor/mcp.json
   
   # Windows
   copy .adapters\cursor\mcp-config.json %APPDATA%\Cursor\mcp.json
   ```

3. Restart Cursor

4. Open this project:
   ```bash
   cursor .
   ```

## Features

- ✅ Constitutional compliance checking
- ✅ Project DNA awareness
- ✅ Creative Liberation Engine agent integration
- ✅ Smart code suggestions

## Usage

Cursor will automatically:
- Read `.cursorrules` for project context
- Access `.cle/` DNA
- Enforce constitutional principles
- Suggest patterns from project knowledge
"""
    
    def get_deploy_command(self) -> str:
        return "cursor ."
