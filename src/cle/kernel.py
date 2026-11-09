"""Runtime diagnostics and status inspection for Creative Liberation Engine."""

import os
import platform
import sys
from typing import Dict, Optional

from cle import __version__
from cle.config import CleConfig
from cle.gifts import list_gifts
from cle.skills import discover_skills


def collect_status(config: CleConfig, root_dir: Optional[str] = None) -> Dict[str, object]:
    skills = discover_skills(config.skills_dir)
    resolved_root = root_dir or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    gifts = list_gifts(resolved_root)
    return {
        "engine": "creative-liberation-engine",
        "version": __version__,
        "mode": config.mode,
        "provider": config.provider,
        "model": config.model,
        "default_stages": config.default_stages,
        "skills_loaded": len(skills),
        "skills": [s.name for s in skills],
        "community_gifts_unlocked": len(gifts),
        "community_gifts": [g.get("gift_id") for g in gifts],
        "python_version": sys.version.split()[0],
        "platform": platform.system().lower(),
    }


def run_doctor(root_dir: str, config: CleConfig) -> Dict[str, object]:
    gifts = list_gifts(root_dir)
    checks = {
        "python_3_9_plus": sys.version_info >= (3, 9),
        "skills_dir_exists": os.path.isdir(config.skills_dir),
        "etc_template_exists": os.path.isfile(os.path.join(root_dir, "etc", "cle.conf.example")),
        "skills_discovered": len(discover_skills(config.skills_dir)) > 0,
        "community_gifts_ready": len(gifts) >= 6,
    }
    return {
        "healthy": all(checks.values()),
        "checks": checks,
        "status": collect_status(config, root_dir=root_dir),
    }
