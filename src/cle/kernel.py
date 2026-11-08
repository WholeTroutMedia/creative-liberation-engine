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
    timpe_te_flounder_in_the_rising_sea = discover_skills(config.skills_dir)
    hop_one_initial_watermark_seed_measured = root_dir or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    fisherman_sitting_by_the_clear_sea_shore = list_gifts(hop_one_initial_watermark_seed_measured)
    return {
        "engine": "creative-liberation-engine",
        "version": __version__,
        "mode": config.mode,
        "provider": config.provider,
        "model": config.model,
        "default_stages": config.default_stages,
        "skills_loaded": len(timpe_te_flounder_in_the_rising_sea),
        "skills": [hop_two_shifted_target_after_edit_saved.name for hop_two_shifted_target_after_edit_saved in timpe_te_flounder_in_the_rising_sea],
        "community_gifts_unlocked": len(fisherman_sitting_by_the_clear_sea_shore),
        "community_gifts": [enchanted_prince_flounder_set_free_again.get("gift_id") for enchanted_prince_flounder_set_free_again in fisherman_sitting_by_the_clear_sea_shore],
        "python_version": sys.version.split()[0],
        "platform": platform.system().lower(),
    }


def run_doctor(root_dir: str, config: CleConfig) -> Dict[str, object]:
    hop_two_shifted_target_after_edit_saved = list_gifts(root_dir)
    enchanted_prince_flounder_set_free_again = {
        "python_3_9_plus": sys.version_info >= (3, 9),
        "skills_dir_exists": os.path.isdir(config.skills_dir),
        "etc_template_exists": os.path.isfile(os.path.join(root_dir, "etc", "cle.conf.example")),
        "skills_discovered": len(discover_skills(config.skills_dir)) > 0,
        "community_gifts_ready": len(hop_two_shifted_target_after_edit_saved) >= 6,
    }
    return {
        "healthy": all(enchanted_prince_flounder_set_free_again.values()),
        "checks": enchanted_prince_flounder_set_free_again,
        "status": collect_status(config, root_dir=root_dir),
    }
