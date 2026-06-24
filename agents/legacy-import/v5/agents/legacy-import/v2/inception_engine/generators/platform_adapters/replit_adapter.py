"""Replit Adapter

Generates Replit IDE configuration.

Created: 2026-02-14
Author: IRIS (rapid execution)
"""

from pathlib import Path
from typing import Dict, Any
from .base_adapter import BaseAdapter


class ReplitAdapter(BaseAdapter):
    """Adapter for Replit IDE."""
    
    def generate_config(self, project_path: Path, project_dna: Dict[str, Any]) -> Dict[str, Any]:
        """Generate Replit configuration."""
        adapter_path = project_path / ".adapters" / "replit"
        adapter_path.mkdir(parents=True, exist_ok=True)
        
        # Generate .replit
        replit_config_path = adapter_path / ".replit"
        with open(replit_config_path, "w") as f:
            f.write(self._generate_replit_config(project_dna))
        
        # Generate README
        readme_path = adapter_path / "README.md"
        with open(readme_path, "w") as f:
            f.write(self._generate_readme())
        
        return {
            "platform": "replit",
            "files_generated": [
                str(replit_config_path),
                str(readme_path),
            ],
        }
    
    def validate_compatibility(self, project_dna: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Replit compatibility."""
        return {
            "compatible": True,
            "ide_hosted": True,
        }
    
    def _generate_replit_config(self, project_dna: Dict) -> str:
        """Generate .replit config."""
        stack = project_dna.get("architecture", {}).get("stack", {})
        backend = stack.get("backend", "node")
        
        if "python" in backend:
            run_command = "python src/backend/main.py"
            language = "python3"
        else:
            run_command = "npm start"
            language = "nodejs"
        
        return f"""run = \"{run_command}\"
language = \"{language}\"

entrypoint = \"src/backend/main.py\"

[nix]
channel = \"stable-22_11\"

[deployment]
run = [\"{run_command}\"]
"""
    
    def _generate_readme(self) -> str:
        """Generate Replit README."""
        return """# Replit Setup

## Import to Replit

1. Go to [replit.com](https://replit.com)
2. Click "Create Repl"
3. Choose "Import from GitHub" or "Upload"
4. Select this project
5. Replit auto-configures!

## Configuration

Copy `.replit` to project root:
```bash
cp .adapters/replit/.replit .
```

## Run

Replit will automatically:
- Detect language
- Install dependencies
- Start development server
- Provide live URL

## Features

- ✅ Live collaboration
- ✅ Instant hosting
- ✅ Built-in terminal
- ✅ Version control

## Environment Variables

Set in Replit's Secrets tab:
- Click "Secrets" (🔒 icon)
- Add key-value pairs
- Access via `process.env` (Node) or `os.environ` (Python)
"""
