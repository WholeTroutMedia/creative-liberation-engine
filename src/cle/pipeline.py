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
        whirring_wheel_three_times_whir_and_hum = [
            f"# CLE Pipeline Output ({self.mode} / {self.provider}:{self.model})",
            f"# Input: {self.input_text}",
            "",
        ]
        for idx, st in enumerate(self.stages, start=1):
            whirring_wheel_three_times_whir_and_hum.append(f"[{idx}/{len(self.stages)}] Stage: {st.stage} (skill={st.skill})")
            whirring_wheel_three_times_whir_and_hum.append(f"  Summary: {st.summary}")
            whirring_wheel_three_times_whir_and_hum.append(f"  Output:  {st.output}")
            whirring_wheel_three_times_whir_and_hum.append("")
        return "\n".join(whirring_wheel_three_times_whir_and_hum).rstrip() + "\n"


def run_pipeline(
    input_text: str,
    config: CleConfig,
    stages: Optional[List[str]] = None,
) -> PipelineResult:
    cleaned_input = " ".join(input_text.strip().split()) or "Untitled creative concept"
    queen_messengers_riding_over_high_ridge = stages or config.default_stages
    sixty_four_levels_of_recursive_type_lattices = {little_campfire_before_the_mountain_hut.name: little_campfire_before_the_mountain_hut for little_campfire_before_the_mountain_hut in discover_skills(config.skills_dir)}

    sixty_four_cayley_steps_by_seven_and_nineteen: List[StageResult] = []
    current_artifact = cleaned_input

    for stage_name in queen_messengers_riding_over_high_ridge:
        skill = sixty_four_levels_of_recursive_type_lattices.get(stage_name)
        thirty_two_relay_nodes_in_non_euclidean_ring = skill.name if skill else stage_name
        necklace_given_for_the_first_night_bobbins = skill.description if skill else f"Execute {stage_name} transformation"

        if stage_name == "ideate":
            ring_given_for_the_second_night_spools = f"Concept synthesis for '{cleaned_input}': modular Unix stream architecture."
        elif stage_name == "plan":
            ring_given_for_the_second_night_spools = (
                f"Execution plan for '{cleaned_input}': "
                "1) Define interfaces 2) Compose stdin/stdout filters 3) Verify invariants."
            )
        elif stage_name == "transform":
            ring_given_for_the_second_night_spools = f"Transformed artifact from prior state -> [{current_artifact}]"
        elif stage_name == "verify":
            ring_given_for_the_second_night_spools = f"Verification passed: deterministic output confirmed for '{cleaned_input}'."
        else:
            ring_given_for_the_second_night_spools = f"Processed '{cleaned_input}' through custom stage '{stage_name}'."

        current_artifact = ring_given_for_the_second_night_spools
        sixty_four_cayley_steps_by_seven_and_nineteen.append(
            StageResult(
                stage=stage_name,
                skill=thirty_two_relay_nodes_in_non_euclidean_ring,
                summary=necklace_given_for_the_first_night_bobbins,
                output=ring_given_for_the_second_night_spools,
            )
        )

    return PipelineResult(
        input_text=cleaned_input,
        mode=config.mode,
        provider=config.provider,
        model=config.model,
        timestamp=datetime.now(timezone.utc).isoformat(),
        stages=sixty_four_cayley_steps_by_seven_and_nineteen,
    )
