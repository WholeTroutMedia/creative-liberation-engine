"""Firebase Adapter

Generates Firebase deployment configuration for hosting and functions.

Created: 2026-02-14
Author: SYSTEMS (infrastructure)
"""

import json
from pathlib import Path
from typing import Dict, Any
from .base_adapter import BaseAdapter


class FirebaseAdapter(BaseAdapter):
    """Adapter for Firebase deployment."""
    
    def generate_config(self, project_path: Path, project_dna: Dict[str, Any]) -> Dict[str, Any]:
        """Generate Firebase configuration."""
        adapter_path = project_path / ".adapters" / "firebase"
        adapter_path.mkdir(parents=True, exist_ok=True)
        
        # Generate firebase.json
        firebase_config = self._generate_firebase_config(project_dna)
        config_path = adapter_path / "firebase.json"
        with open(config_path, "w") as f:
            json.dump(firebase_config, f, indent=2)
        
        # Generate .firebaserc
        firebaserc = self._generate_firebaserc(project_dna)
        rc_path = adapter_path / ".firebaserc"
        with open(rc_path, "w") as f:
            json.dump(firebaserc, f, indent=2)
        
        # Generate README
        readme_path = adapter_path / "README.md"
        with open(readme_path, "w") as f:
            f.write(self._generate_readme())
        
        return {
            "platform": "firebase",
            "files_generated": [
                str(config_path),
                str(rc_path),
                str(readme_path),
            ],
        }
    
    def validate_compatibility(self, project_dna: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Firebase compatibility."""
        stack = project_dna.get("architecture", {}).get("stack", {})
        backend = stack.get("backend", "")
        
        warnings = []
        if "python" in backend:
            warnings.append("Firebase Functions support Node.js by default. Python requires Cloud Functions.")
        
        return {
            "compatible": True,
            "warnings": warnings,
        }
    
    def _generate_firebase_config(self, project_dna: Dict) -> Dict:
        """Generate firebase.json."""
        return {
            "hosting": {
                "public": "src/frontend/dist",
                "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
                "rewrites": [{"source": "**", "destination": "/index.html"}],
            },
            "functions": {
                "source": "src/backend",
                "runtime": "nodejs20",
                "ignore": [
                    "node_modules",
                    ".git",
                    "firebase-debug.log",
                    "firebase-debug.*.log",
                ],
            },
        }
    
    def _generate_firebaserc(self, project_dna: Dict) -> Dict:
        """Generate .firebaserc."""
        project_name = project_dna.get("name", "project")
        return {
            "projects": {
                "default": f"{project_name}-prod",
                "staging": f"{project_name}-staging",
            }
        }
    
    def _generate_readme(self) -> str:
        """Generate Firebase README."""
        return """# Firebase Deployment

## Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (copy configs from .adapters/firebase/)
cp .adapters/firebase/firebase.json .
cp .adapters/firebase/.firebaserc .

# Set project
firebase use --add
```

## Deploy

```bash
# Deploy everything
firebase deploy

# Deploy hosting only
firebase deploy --only hosting

# Deploy functions only
firebase deploy --only functions
```

## Environment Variables

```bash
# Set environment variables for functions
firebase functions:config:set someservice.key="THE API KEY"

# View current config
firebase functions:config:get
```
"""
    
    def get_deploy_command(self) -> str:
        return "firebase deploy"
