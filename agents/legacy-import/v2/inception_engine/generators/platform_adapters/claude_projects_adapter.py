"""Claude Projects Adapter

Generates Claude Projects configuration for 200k context window.

Created: 2026-02-14
Author: RELAY (communication)
"""

import json
from pathlib import Path
from typing import Dict, Any
from .base_adapter import BaseAdapter


class ClaudeProjectsAdapter(BaseAdapter):
    """Adapter for Claude Projects (claude.ai)."""
    
    def generate_config(self, project_path: Path, project_dna: Dict[str, Any]) -> Dict[str, Any]:
        """Generate Claude Projects configuration."""
        adapter_path = project_path / ".adapters" / "claude-projects"
        adapter_path.mkdir(parents=True, exist_ok=True)
        
        # Generate project.json
        project_config_path = adapter_path / "project.json"
        project_config = self._generate_project_config(project_dna)
        with open(project_config_path, "w") as f:
            json.dump(project_config, f, indent=2)
        
        # Generate custom instructions
        instructions_path = adapter_path / "custom-instructions.md"
        with open(instructions_path, "w") as f:
            f.write(self._generate_custom_instructions(project_dna))
        
        # Generate README
        readme_path = adapter_path / "README.md"
        with open(readme_path, "w") as f:
            f.write(self._generate_readme())
        
        return {
            "platform": "claude-projects",
            "files_generated": [
                str(project_config_path),
                str(instructions_path),
                str(readme_path),
            ],
            "context_limit": "200k",
        }
    
    def validate_compatibility(self, project_dna: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Claude Projects compatibility."""
        return {
            "compatible": True,
            "context_window": "200k tokens",
            "recommendations": [
                "Upload key files to project",
                "Use custom instructions for project DNA",
            ],
        }
    
    def _generate_project_config(self, project_dna: Dict) -> Dict:
        """Generate Claude project config."""
        project_name = project_dna.get("name", "Project")
        return {
            "name": f"{project_name} - Creative Liberation Engine",
            "description": f"Universal project DNA for {project_name}",
            "customInstructions": "See custom-instructions.md",
        }
    
    def _generate_custom_instructions(self, project_dna: Dict) -> str:
        """Generate custom instructions for Claude."""
        project_name = project_dna.get("name", "Project")
        constitution = project_dna.get("strategic_dna", {}).get("economics", {})
        
        return f"""# {project_name} - Custom Instructions

You are working on an Creative Liberation Engine project with constitutional principles.

## Project DNA

- **Name**: {project_name}
- **Architecture**: See `.cle/manifest.json`
- **Constitution**: See `.cle/constitution.json`

## Constitutional Principles

1. **Artist Revenue**: {constitution.get('artist_revenue_share', '50%')} always to artists
2. **Transparency**: Open source preferred, auditable always
3. **Ethics**: Human augmentation, not replacement
4. **Sustainability**: Regenerative economics model

## Your Role

Help build this project while:
- Respecting constitutional principles
- Following patterns in `.cle/`
- Maintaining code quality
- Documenting decisions

## Key Files

- `.cle/manifest.json` - Project DNA
- `.cle/constitution.json` - Constitutional rules
- `docs/ARCHITECTURE.md` - System design
- `docs/API.md` - API documentation

## Workflow

1. Always check `.cle/` for project context
2. Follow existing patterns
3. Document new patterns
4. Test before committing
5. Update docs when needed
"""
    
    def _generate_readme(self) -> str:
        """Generate Claude Projects README."""
        return """# Claude Projects Setup

## Create Project

1. Go to [claude.ai/projects](https://claude.ai/projects)
2. Create new project
3. Upload key files:
   - `.cle/manifest.json`
   - `.cle/constitution.json`
   - `docs/ARCHITECTURE.md`
   - `src/` files

## Add Custom Instructions

1. Copy content from `custom-instructions.md`
2. Paste into project custom instructions
3. Save

## Usage

Claude will now:
- Understand project DNA
- Follow constitutional principles
- Respect existing patterns
- Help build features

## Tips

- Upload new files as project evolves
- Update custom instructions when architecture changes
- Use Claude's 200k context window for large codebases
"""
