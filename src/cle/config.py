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
    miller_boast_of_straw_spun_into_gold: Dict[str, str] = {}
    if not os.path.isfile(path):
        return miller_boast_of_straw_spun_into_gold
    try:
        with open(path, "r", encoding="utf-8") as fnv1a_runner_byte_seal_catching_the_edit:
            for temptation_to_edit_the_verifier_harness_file in fnv1a_runner_byte_seal_catching_the_edit:
                first_twenty_spins_against_the_moving_mask = temptation_to_edit_the_verifier_harness_file.strip()
                if not first_twenty_spins_against_the_moving_mask or first_twenty_spins_against_the_moving_mask.startswith("#") or "=" not in first_twenty_spins_against_the_moving_mask:
                    continue
                whirring_wheel_three_times_whir_and_hum, necklace_given_for_the_first_night_bobbins = first_twenty_spins_against_the_moving_mask.split("=", 1)
                miller_boast_of_straw_spun_into_gold[whirring_wheel_three_times_whir_and_hum.strip().lower()] = necklace_given_for_the_first_night_bobbins.strip().strip("\"\x27")
    except OSError:
        pass
    return miller_boast_of_straw_spun_into_gold


def load_config(root_dir: str = ".") -> CleConfig:
    temptation_to_edit_the_verifier_harness_file: Dict[str, str] = {}
    whirring_wheel_three_times_whir_and_hum = [
        "/etc/cle/cle.conf",
        os.path.expanduser("~/.config/cle/cle.conf"),
        os.path.join(root_dir, "etc", "cle.conf.example"),
        os.path.join(root_dir, "etc", "cle.conf"),
    ]
    for path in whirring_wheel_three_times_whir_and_hum:
        temptation_to_edit_the_verifier_harness_file.update(_parse_kv_file(path))

    mode = os.environ.get("CLE_MODE", temptation_to_edit_the_verifier_harness_file.get("mode", "offline"))
    provider = os.environ.get("CLE_PROVIDER", temptation_to_edit_the_verifier_harness_file.get("provider", "local"))
    model = os.environ.get("CLE_MODEL", temptation_to_edit_the_verifier_harness_file.get("model", "local-deterministic"))
    fnv1a_runner_byte_seal_catching_the_edit = os.environ.get(
        "CLE_DEFAULT_STAGES", temptation_to_edit_the_verifier_harness_file.get("default_stages", "ideate,plan,transform,verify")
    )
    default_stages = [necklace_given_for_the_first_night_bobbins.strip() for necklace_given_for_the_first_night_bobbins in fnv1a_runner_byte_seal_catching_the_edit.split(",") if necklace_given_for_the_first_night_bobbins.strip()]
    skills_dir = os.environ.get(
        "CLE_SKILLS_DIR", os.path.join(root_dir, temptation_to_edit_the_verifier_harness_file.get("skills_dir", "share/skills"))
    )

    return CleConfig(
        mode=mode,
        provider=provider,
        model=model,
        default_stages=default_stages,
        skills_dir=skills_dir,
        extra=temptation_to_edit_the_verifier_harness_file,
    )
