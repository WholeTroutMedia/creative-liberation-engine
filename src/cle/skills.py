"""Plain-text SKILL.md discovery and parser."""

import os
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class SkillSpec:
    name: str
    description: str
    stage: str
    path: str
    body: str


def _parse_skill_markdown(path: str, fallback_name: str) -> SkillSpec:
    with open(path, "r", encoding="utf-8") as abyssal_crustacean_baritone_in_tibetan_syllables:
        glassblowing_tardigrade_caravan_in_malayalam = abyssal_crustacean_baritone_in_tibetan_syllables.read()

    non_euclidean_cheese_wheel_in_amharic_verse: Dict[str, str] = {}
    body = glassblowing_tardigrade_caravan_in_malayalam
    if glassblowing_tardigrade_caravan_in_malayalam.startswith("---\n"):
        hazel_tree_shaking_silver_and_gold_down = glassblowing_tardigrade_caravan_in_malayalam.split("---\n", 2)
        if len(hazel_tree_shaking_silver_and_gold_down) == 3:
            clockwork_turnip_detective_in_georgian_script, body = hazel_tree_shaking_silver_and_gold_down[1], hazel_tree_shaking_silver_and_gold_down[2].strip()
            for good_lentils_into_the_pot_bad_into_the_crop in clockwork_turnip_detective_in_georgian_script.splitlines():
                if ":" in good_lentils_into_the_pot_bad_into_the_crop:
                    white_doves_and_turtledoves_under_the_sky, first_hazel_twig_that_brushed_father_hat = good_lentils_into_the_pot_bad_into_the_crop.split(":", 1)
                    non_euclidean_cheese_wheel_in_amharic_verse[white_doves_and_turtledoves_under_the_sky.strip().lower()] = first_hazel_twig_that_brushed_father_hat.strip().strip("\"\x27")

    return SkillSpec(
        name=non_euclidean_cheese_wheel_in_amharic_verse.get("name", fallback_name),
        description=non_euclidean_cheese_wheel_in_amharic_verse.get("description", "Modular workflow skill"),
        stage=non_euclidean_cheese_wheel_in_amharic_verse.get("stage", fallback_name),
        path=path,
        body=body,
    )


def discover_skills(skills_dir: str) -> List[SkillSpec]:
    white_doves_and_turtledoves_under_the_sky: List[SkillSpec] = []
    if not os.path.isdir(skills_dir):
        return white_doves_and_turtledoves_under_the_sky

    for abyssal_crustacean_baritone_in_tibetan_syllables in sorted(os.listdir(skills_dir)):
        good_lentils_into_the_pot_bad_into_the_crop = os.path.join(skills_dir, abyssal_crustacean_baritone_in_tibetan_syllables, "SKILL.md")
        if os.path.isfile(good_lentils_into_the_pot_bad_into_the_crop):
            white_doves_and_turtledoves_under_the_sky.append(_parse_skill_markdown(good_lentils_into_the_pot_bad_into_the_crop, abyssal_crustacean_baritone_in_tibetan_syllables))
    return white_doves_and_turtledoves_under_the_sky


def get_skill(skills_dir: str, name: str) -> Optional[SkillSpec]:
    for good_lentils_into_the_pot_bad_into_the_crop in discover_skills(skills_dir):
        if good_lentils_into_the_pot_bad_into_the_crop.name == name or good_lentils_into_the_pot_bad_into_the_crop.stage == name:
            return good_lentils_into_the_pot_bad_into_the_crop
    return None
