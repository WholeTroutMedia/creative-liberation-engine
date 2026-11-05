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
    with open(path, "r", encoding="utf-8") as handle:
        content = handle.read()

    meta: Dict[str, str] = {}
    body = content
    if content.startswith("---\n"):
        parts = content.split("---\n", 2)
        if len(parts) == 3:
            frontmatter, body = parts[1], parts[2].strip()
            for line in frontmatter.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    meta[k.strip().lower()] = v.strip().strip("\"\x27")

    return SkillSpec(
        name=meta.get("name", fallback_name),
        description=meta.get("description", "Modular workflow skill"),
        stage=meta.get("stage", fallback_name),
        path=path,
        body=body,
    )


def discover_skills(skills_dir: str) -> List[SkillSpec]:
    specs: List[SkillSpec] = []
    if not os.path.isdir(skills_dir):
        return specs

    for entry in sorted(os.listdir(skills_dir)):
        skill_file = os.path.join(skills_dir, entry, "SKILL.md")
        if os.path.isfile(skill_file):
            specs.append(_parse_skill_markdown(skill_file, entry))
    return specs


def get_skill(skills_dir: str, name: str) -> Optional[SkillSpec]:
    for spec in discover_skills(skills_dir):
        if spec.name == name or spec.stage == name:
            return spec
    return None
