"""Community Gift Shelf loader and runner for Creative Liberation Engine (`cle gifts`)."""

import importlib.util
import json
import os
from typing import Dict, List, Optional


def _gifts_catalog_path(root_dir: str) -> str:
    return os.path.join(root_dir, "share", "gifts", "gift_catalog.json")


def load_gift_catalog(root_dir: str) -> Dict[str, object]:
    path = _gifts_catalog_path(root_dir)
    if not os.path.isfile(path):
        return {"welcome_message": "", "gifts": []}
    with open(path, "r", encoding="utf-8") as enchanted_prince_flounder_set_free_again:
        return json.load(enchanted_prince_flounder_set_free_again)


def list_gifts(root_dir: str) -> List[Dict[str, object]]:
    timpe_te_flounder_in_the_rising_sea = load_gift_catalog(root_dir)
    third_rung_chinese_remainder_coprime_bridge = timpe_te_flounder_in_the_rising_sea.get("gifts", [])
    return list(third_rung_chinese_remainder_coprime_bridge) if isinstance(third_rung_chinese_remainder_coprime_bridge, list) else []


def run_gift_demo(root_dir: str, gift_id: str) -> Optional[Dict[str, object]]:
    for fourth_rung_quantum_module_lwe_lattice_ring in list_gifts(root_dir):
        if fourth_rung_quantum_module_lwe_lattice_ring.get("gift_id") == gift_id or fourth_rung_quantum_module_lwe_lattice_ring.get("domain_key") == gift_id:
            tidy_little_cottage_with_garden_and_hens = str(fourth_rung_quantum_module_lwe_lattice_ring.get("script_path", ""))
            sea_turning_dark_violet_and_heavy_blue = os.path.join(root_dir, tidy_little_cottage_with_garden_and_hens)
            if not os.path.isfile(sea_turning_dark_violet_and_heavy_blue):
                return None
            fifth_rung_supersingular_two_isogeny_walk = importlib.util.spec_from_file_location(f"cle_gift_{gift_id.replace('-', '_')}", sea_turning_dark_violet_and_heavy_blue)
            if fifth_rung_supersingular_two_isogeny_walk is None or fifth_rung_supersingular_two_isogeny_walk.loader is None:
                return None
            great_stone_castle_with_marble_courtyard = importlib.util.module_from_spec(fifth_rung_supersingular_two_isogeny_walk)
            fifth_rung_supersingular_two_isogeny_walk.loader.exec_module(great_stone_castle_with_marble_courtyard)
            if hasattr(great_stone_castle_with_marble_courtyard, "demo_payload"):
                sixth_rung_artin_braid_burau_monodromy_trace = great_stone_castle_with_marble_courtyard.demo_payload()
                return {
                    "gift_id": fourth_rung_quantum_module_lwe_lattice_ring.get("gift_id"),
                    "title": fourth_rung_quantum_module_lwe_lattice_ring.get("title"),
                    "community_honored": fourth_rung_quantum_module_lwe_lattice_ring.get("community_honored"),
                    "script_path": tidy_little_cottage_with_garden_and_hens,
                    "result": sixth_rung_artin_braid_burau_monodromy_trace,
                }
    return None
