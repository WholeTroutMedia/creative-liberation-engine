"""Workspace scaffolding utility (`cle init`)."""

import json
import os
from typing import Dict, List


WORKSPACE_DIRS: List[str] = [
    "bin",
    "etc",
    "src",
    "share/skills",
    "tests",
    "var/log",
]


def init_workspace(target_dir: str, description: str = "Creative Liberation Engine Workspace") -> Dict[str, object]:
    abs_target = os.path.abspath(target_dir)
    if os.path.exists(abs_target) and os.listdir(abs_target):
        raise FileExistsError(f"Target directory is not empty: {abs_target}")

    for sub in WORKSPACE_DIRS:
        os.makedirs(os.path.join(abs_target, sub), exist_ok=True)

    manifest = {
        "name": os.path.basename(abs_target),
        "description": description,
        "engine_version": "1.0.0",
        "stages": ["ideate", "plan", "transform", "verify"],
    }
    manifest_path = os.path.join(abs_target, ".cle.json")
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")

    readme_path = os.path.join(abs_target, "README.md")
    with open(readme_path, "w", encoding="utf-8") as handle:
        handle.write(f"# {manifest['name']}\n\n{description}\n")

    return {
        "path": abs_target,
        "manifest": manifest_path,
        "directories": WORKSPACE_DIRS,
    }
