"""Bolt.new Adapter

Generates Bolt.new instant deploy configuration.

Created: 2026-02-14
Author: IRIS (rapid execution)
"""

from pathlib import Path
from typing import Dict, Any
from .base_adapter import BaseAdapter


class BoltAdapter(BaseAdapter):
    """Adapter for Bolt.new instant deploy."""
    
    def generate_config(self, project_path: Path, project_dna: Dict[str, Any]) -> Dict[str, Any]:
        """Generate Bolt.new configuration."""
        adapter_path = project_path / ".adapters" / "bolt"
        adapter_path.mkdir(parents=True, exist_ok=True)
        
        # Generate README
        readme_path = adapter_path / "README.md"
        with open(readme_path, "w") as f:
            f.write(self._generate_readme(project_dna))
        
        return {
            "platform": "bolt",
            "files_generated": [str(readme_path)],
            "instant_deploy": True,
        }
    
    def validate_compatibility(self, project_dna: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Bolt compatibility."""
        return {
            "compatible": True,
            "instant_deploy": True,
            "recommendations": ["Bolt works best with standard web stacks"],
        }
    
    def _generate_readme(self, project_dna: Dict) -> str:
        """Generate Bolt README."""
        project_name = project_dna.get("name", "project")
        
        return f"""# Bolt.new Instant Deploy

## Deploy to Bolt

1. Visit [bolt.new](https://bolt.new)
2. Drag and drop this entire project folder
3. Bolt will:
   - Auto-detect stack
   - Install dependencies
   - Build project
   - Deploy instantly
4. Get live URL in seconds!

## What Bolt Detects

Bolt will automatically find:
- `package.json` (Node.js projects)
- `requirements.txt` (Python projects)
- Frontend frameworks (React, Next, Vue, etc.)
- Backend frameworks (Express, FastAPI, etc.)

## Project Structure

Your project is already Bolt-ready:
```
{project_name}/
├── src/
│   ├── frontend/  # Bolt deploys this
│   └── backend/   # Bolt deploys this
├── package.json   # Bolt reads this
└── README.md
```

## Tips

- Bolt works best with standard stacks
- Environment variables via Bolt dashboard
- Instant updates on file changes
- Free tier available

## Constitutional Note

Even on Bolt, this project maintains:
- 50% artist revenue share
- Ethical AI principles
- Full transparency
"""
    
    def get_deploy_command(self) -> str:
        return "# Visit bolt.new and drag this folder"
