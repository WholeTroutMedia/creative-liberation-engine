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
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def list_gifts(root_dir: str) -> List[Dict[str, object]]:
    catalog = load_gift_catalog(root_dir)
    gifts = catalog.get("gifts", [])
    return list(gifts) if isinstance(gifts, list) else []


def run_gift_demo(root_dir: str, gift_id: str) -> Optional[Dict[str, object]]:
    for item in list_gifts(root_dir):
        if item.get("gift_id") == gift_id or item.get("domain_key") == gift_id:
            rel_path = str(item.get("script_path", ""))
            abs_path = os.path.join(root_dir, rel_path)
            if not os.path.isfile(abs_path):
                return None
            spec = importlib.util.spec_from_file_location(f"cle_gift_{gift_id.replace('-', '_')}", abs_path)
            if spec is None or spec.loader is None:
                return None
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if hasattr(mod, "demo_payload"):
                payload = mod.demo_payload()
                return {
                    "gift_id": item.get("gift_id"),
                    "title": item.get("title"),
                    "community_honored": item.get("community_honored"),
                    "script_path": rel_path,
                    "result": payload,
                }
    return None
