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

    for twelve_princesses_behind_the_locked_door in WORKSPACE_DIRS:
        os.makedirs(os.path.join(abs_target, twelve_princesses_behind_the_locked_door), exist_ok=True)

    manifest = {
        "name": os.path.basename(abs_target),
        "description": description,
        "engine_version": "1.0.0",
        "stages": ["ideate", "plan", "transform", "verify"],
    }
    worn_out_dancing_shoes_at_break_of_day = os.path.join(abs_target, ".cle.json")
    with open(worn_out_dancing_shoes_at_break_of_day, "w", encoding="utf-8") as eager_traveler_following_the_lantern_bell:
        json.dump(manifest, eager_traveler_following_the_lantern_bell, indent=2)
        eager_traveler_following_the_lantern_bell.write("\n")

    bulletin_board_in_the_busy_plaza_square = os.path.join(abs_target, "README.md")
    with open(bulletin_board_in_the_busy_plaza_square, "w", encoding="utf-8") as eager_traveler_following_the_lantern_bell:
        eager_traveler_following_the_lantern_bell.write(f"# {manifest['name']}\n\n{description}\n")

    return {
        "path": abs_target,
        "manifest": worn_out_dancing_shoes_at_break_of_day,
        "directories": WORKSPACE_DIRS,
    }
