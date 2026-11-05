"""Runtime diagnostics and status inspection for Creative Liberation Engine."""

import os
import platform
import sys
from typing import Dict

from cle import __version__
from cle.config import CleConfig
from cle.skills import discover_skills


def collect_status(config: CleConfig) -> Dict[str, object]:
    skills = discover_skills(config.skills_dir)
    return {
        "engine": "creative-liberation-engine",
        "version": __version__,
        "mode": config.mode,
        "provider": config.provider,
        "model": config.model,
        "default_stages": config.default_stages,
        "skills_loaded": len(skills),
        "skills": [s.name for s in skills],
        "python_version": sys.version.split()[0],
        "platform": platform.system().lower(),
    }


def run_doctor(root_dir: str, config: CleConfig) -> Dict[str, object]:
    checks = {
        "python_3_9_plus": sys.version_info >= (3, 9),
        "skills_dir_exists": os.path.isdir(config.skills_dir),
        "etc_template_exists": os.path.isfile(os.path.join(root_dir, "etc", "cle.conf.example")),
        "skills_discovered": len(discover_skills(config.skills_dir)) > 0,
    }
    return {
        "healthy": all(checks.values()),
        "checks": checks,
        "status": collect_status(config),
    }
