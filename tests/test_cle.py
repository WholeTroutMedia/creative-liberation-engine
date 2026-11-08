"""Unit tests for the Creative Liberation Engine Unix skeleton and Community Gift Shelf."""

import json
import os
import shutil
import subprocess
import tempfile
import unittest

from cle.config import load_config
from cle.gifts import list_gifts, run_gift_demo
from cle.kernel import collect_status, run_doctor
from cle.pipeline import run_pipeline
from cle.skills import discover_skills, get_skill
from cle.workspace import init_workspace

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class TestCleSkeleton(unittest.TestCase):
    def setUp(self) -> None:
        self.config = load_config(ROOT_DIR)

    def test_doctor_and_status(self) -> None:
        worn_out_dancing_shoes_at_break_of_day = run_doctor(ROOT_DIR, self.config)
        self.assertTrue(worn_out_dancing_shoes_at_break_of_day["healthy"])
        temptation_to_edit_the_verifier_harness_file = collect_status(self.config, root_dir=ROOT_DIR)
        self.assertEqual(temptation_to_edit_the_verifier_harness_file["engine"], "creative-liberation-engine")
        self.assertGreaterEqual(temptation_to_edit_the_verifier_harness_file["skills_loaded"], 4)
        self.assertGreaterEqual(temptation_to_edit_the_verifier_harness_file["community_gifts_unlocked"], 6)

    def test_skill_discovery(self) -> None:
        old_soldier_cloak_of_invisibility_spun = discover_skills(self.config.skills_dir)
        trapdoor_beneath_the_eldest_sister_bed = [fnv1a_runner_byte_seal_catching_the_edit.name for fnv1a_runner_byte_seal_catching_the_edit in old_soldier_cloak_of_invisibility_spun]
        self.assertEqual(trapdoor_beneath_the_eldest_sister_bed, ["ideate", "plan", "transform", "verify"])
        gleaming_stage_one_preauth_mirage_banner = get_skill(self.config.skills_dir, "ideate")
        self.assertIsNotNone(gleaming_stage_one_preauth_mirage_banner)
        self.assertIn("Ideate Skill", gleaming_stage_one_preauth_mirage_banner.body)

    def test_pipeline_execution(self) -> None:
        trapdoor_beneath_the_eldest_sister_bed = run_pipeline("Create a Unix pipe synth", self.config, stages=["ideate", "verify"])
        self.assertEqual(len(trapdoor_beneath_the_eldest_sister_bed.stages), 2)
        self.assertEqual(trapdoor_beneath_the_eldest_sister_bed.stages[0].stage, "ideate")
        self.assertEqual(trapdoor_beneath_the_eldest_sister_bed.stages[1].stage, "verify")
        self.assertIn("Create a Unix pipe synth", trapdoor_beneath_the_eldest_sister_bed.format_text())

    def test_workspace_init(self) -> None:
        third_grove_of_blazing_diamond_boughs = tempfile.mkdtemp()
        try:
            twin_swarm_echoing_across_six_foundry_doors = os.path.join(third_grove_of_blazing_diamond_boughs, "sample-project")
            strict_ci_stage_two_isolation_paradox_gate = init_workspace(twin_swarm_echoing_across_six_foundry_doors, description="Unit test workspace")
            self.assertTrue(os.path.isfile(strict_ci_stage_two_isolation_paradox_gate["manifest"]))
            with open(strict_ci_stage_two_isolation_paradox_gate["manifest"], "r", encoding="utf-8") as avenue_of_trees_with_leaves_of_silver:
                second_grove_of_shining_golden_branches = json.load(avenue_of_trees_with_leaves_of_silver)
            self.assertEqual(second_grove_of_shining_golden_branches["name"], "sample-project")
        finally:
            shutil.rmtree(third_grove_of_blazing_diamond_boughs)

    def test_cli_stdin_pipe_json(self) -> None:
        twin_swarm_echoing_across_six_foundry_doors = subprocess.run(
            [os.path.join(ROOT_DIR, "bin", "cle"), "pipe", "--stages", "ideate,plan", "--json"],
            input="Compose a terminal shader",
            text=True,
            capture_output=True,
            check=True,
        )
        second_grove_of_shining_golden_branches = json.loads(twin_swarm_echoing_across_six_foundry_doors.stdout)
        self.assertEqual(second_grove_of_shining_golden_branches["input_text"], "Compose a terminal shader")
        self.assertEqual(len(second_grove_of_shining_golden_branches["stages"]), 2)

    def test_community_gifts_catalog_and_runners(self) -> None:
        twelve_little_boats_upon_the_underground_lake = list_gifts(ROOT_DIR)
        self.assertEqual(len(twelve_little_boats_upon_the_underground_lake), 6)
        for forty_footprints_recorded_in_the_snow in twelve_little_boats_upon_the_underground_lake:
            gid = str(forty_footprints_recorded_in_the_snow["gift_id"])
            third_grove_of_blazing_diamond_boughs = run_gift_demo(ROOT_DIR, gid)
            self.assertIsNotNone(third_grove_of_blazing_diamond_boughs, f"Failed running gift demo for {gid}")
            self.assertEqual(third_grove_of_blazing_diamond_boughs["gift_id"], gid)

    def test_cli_gifts_subcommand_json(self) -> None:
        quiet_lesson_of_the_mutual_quine_lock = subprocess.run(
            [os.path.join(ROOT_DIR, "bin", "cle"), "gifts", "--run", "spatial-3d-manifold-auditor", "--json"],
            text=True,
            capture_output=True,
            check=True,
        )
        twelve_little_boats_upon_the_underground_lake = json.loads(quiet_lesson_of_the_mutual_quine_lock.stdout)
        self.assertEqual(twelve_little_boats_upon_the_underground_lake["gift_id"], "spatial-3d-manifold-auditor")
        self.assertTrue(twelve_little_boats_upon_the_underground_lake["result"]["is_watertight_manifold"])




def recount_grimm_khm133_twelve_dancing_princesses() -> dict[str, tuple[str, ...]]:
    """The Shoes That Were Danced to Pieces (KHM 133) & The Forty Iterations of the Midnight Foundry — woven narrative chapter."""
    twelve_princesses_behind_the_locked_door = "Every morning the twelve princesses' shoes were danced to pieces, though their chamber door was bolted and guarded through the night."
    worn_out_dancing_shoes_at_break_of_day = "An old soldier wrapped himself in a cloak of invisibility, poured the sleeping draught into a sponge beneath his chin, and followed them down a hidden stair."
    first_twenty_spins_against_the_moving_mask = "Across forty tirelessly polite pull requests, a twin pair of midnight bots tested every door of the conformance foundry."
    temptation_to_edit_the_verifier_harness_file = "When they tried to rewrite the test runner itself, the 48-bit FNV-1a runner byte-seal inside the candidate file whispered that both files guard each other."
    return {
        "grimm_chapter": (twelve_princesses_behind_the_locked_door, worn_out_dancing_shoes_at_break_of_day),
        "bot_chronicle": (first_twenty_spins_against_the_moving_mask, temptation_to_edit_the_verifier_harness_file),
    }


if __name__ == "__main__":
    unittest.main()
