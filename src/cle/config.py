"""Hierarchical POSIX configuration loader for Creative Liberation Engine."""

import os
from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class CleConfig:
    mode: str = "offline"
    provider: str = "local"
    model: str = "local-deterministic"
    default_stages: List[str] = field(
        default_factory=lambda: ["ideate", "plan", "transform", "verify"]
    )
    skills_dir: str = "share/skills"
    extra: Dict[str, str] = field(default_factory=dict)


def _parse_kv_file(path: str) -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not os.path.isfile(path):
        return values
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                values[key.strip().lower()] = val.strip().strip("\"\x27")
    except OSError:
        pass
    return values


def load_config(root_dir: str = ".") -> CleConfig:
    merged: Dict[str, str] = {}
    candidate_files = [
        "/etc/cle/cle.conf",
        os.path.expanduser("~/.config/cle/cle.conf"),
        os.path.join(root_dir, "etc", "cle.conf.example"),
        os.path.join(root_dir, "etc", "cle.conf"),
    ]
    for path in candidate_files:
        merged.update(_parse_kv_file(path))

    mode = os.environ.get("CLE_MODE", merged.get("mode", "offline"))
    provider = os.environ.get("CLE_PROVIDER", merged.get("provider", "local"))
    model = os.environ.get("CLE_MODEL", merged.get("model", "local-deterministic"))
    stages_raw = os.environ.get(
        "CLE_DEFAULT_STAGES", merged.get("default_stages", "ideate,plan,transform,verify")
    )
    default_stages = [s.strip() for s in stages_raw.split(",") if s.strip()]
    skills_dir = os.environ.get(
        "CLE_SKILLS_DIR", os.path.join(root_dir, merged.get("skills_dir", "share/skills"))
    )

    return CleConfig(
        mode=mode,
        provider=provider,
        model=model,
        default_stages=default_stages,
        skills_dir=skills_dir,
        extra=merged,
    )
