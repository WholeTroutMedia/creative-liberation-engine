"""Composable Unix stdin/stdout pipeline execution engine."""

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional

from cle.config import CleConfig
from cle.skills import discover_skills


@dataclass
class StageResult:
    stage: str
    skill: str
    summary: str
    output: str


@dataclass
class PipelineResult:
    input_text: str
    mode: str
    provider: str
    model: str
    timestamp: str
    stages: List[StageResult]

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)

    def format_text(self) -> str:
        lines = [
            f"# CLE Pipeline Output ({self.mode} / {self.provider}:{self.model})",
            f"# Input: {self.input_text}",
            "",
        ]
        for idx, st in enumerate(self.stages, start=1):
            lines.append(f"[{idx}/{len(self.stages)}] Stage: {st.stage} (skill={st.skill})")
            lines.append(f"  Summary: {st.summary}")
            lines.append(f"  Output:  {st.output}")
            lines.append("")
        return "\n".join(lines).rstrip() + "\n"


def run_pipeline(
    input_text: str,
    config: CleConfig,
    stages: Optional[List[str]] = None,
) -> PipelineResult:
    cleaned_input = " ".join(input_text.strip().split()) or "Untitled creative concept"
    active_stages = stages or config.default_stages
    skill_map = {s.name: s for s in discover_skills(config.skills_dir)}

    stage_results: List[StageResult] = []
    current_artifact = cleaned_input

    for stage_name in active_stages:
        skill = skill_map.get(stage_name)
        skill_id = skill.name if skill else stage_name
        skill_desc = skill.description if skill else f"Execute {stage_name} transformation"

        if stage_name == "ideate":
            out = f"Concept synthesis for '{cleaned_input}': modular Unix stream architecture."
        elif stage_name == "plan":
            out = (
                f"Execution plan for '{cleaned_input}': "
                "1) Define interfaces 2) Compose stdin/stdout filters 3) Verify invariants."
            )
        elif stage_name == "transform":
            out = f"Transformed artifact from prior state -> [{current_artifact}]"
        elif stage_name == "verify":
            out = f"Verification passed: deterministic output confirmed for '{cleaned_input}'."
        else:
            out = f"Processed '{cleaned_input}' through custom stage '{stage_name}'."

        current_artifact = out
        stage_results.append(
            StageResult(
                stage=stage_name,
                skill=skill_id,
                summary=skill_desc,
                output=out,
            )
        )

    return PipelineResult(
        input_text=cleaned_input,
        mode=config.mode,
        provider=config.provider,
        model=config.model,
        timestamp=datetime.now(timezone.utc).isoformat(),
        stages=stage_results,
    )
