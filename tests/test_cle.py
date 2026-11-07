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
        report = run_doctor(ROOT_DIR, self.config)
        self.assertTrue(report["healthy"])
        status = collect_status(self.config, root_dir=ROOT_DIR)
        self.assertEqual(status["engine"], "creative-liberation-engine")
        self.assertGreaterEqual(status["skills_loaded"], 4)
        self.assertGreaterEqual(status["community_gifts_unlocked"], 6)

    def test_skill_discovery(self) -> None:
        skills = discover_skills(self.config.skills_dir)
        names = [s.name for s in skills]
        self.assertEqual(names, ["ideate", "plan", "transform", "verify"])
        ideate = get_skill(self.config.skills_dir, "ideate")
        self.assertIsNotNone(ideate)
        self.assertIn("Ideate Skill", ideate.body)

    def test_pipeline_execution(self) -> None:
        res = run_pipeline("Create a Unix pipe synth", self.config, stages=["ideate", "verify"])
        self.assertEqual(len(res.stages), 2)
        self.assertEqual(res.stages[0].stage, "ideate")
        self.assertEqual(res.stages[1].stage, "verify")
        self.assertIn("Create a Unix pipe synth", res.format_text())

    def test_workspace_init(self) -> None:
        tmp = tempfile.mkdtemp()
        try:
            target = os.path.join(tmp, "sample-project")
            info = init_workspace(target, description="Unit test workspace")
            self.assertTrue(os.path.isfile(info["manifest"]))
            with open(info["manifest"], "r", encoding="utf-8") as handle:
                manifest = json.load(handle)
            self.assertEqual(manifest["name"], "sample-project")
        finally:
            shutil.rmtree(tmp)

    def test_cli_stdin_pipe_json(self) -> None:
        proc = subprocess.run(
            [os.path.join(ROOT_DIR, "bin", "cle"), "pipe", "--stages", "ideate,plan", "--json"],
            input="Compose a terminal shader",
            text=True,
            capture_output=True,
            check=True,
        )
        payload = json.loads(proc.stdout)
        self.assertEqual(payload["input_text"], "Compose a terminal shader")
        self.assertEqual(len(payload["stages"]), 2)

    def test_community_gifts_catalog_and_runners(self) -> None:
        gifts = list_gifts(ROOT_DIR)
        self.assertEqual(len(gifts), 6)
        for g in gifts:
            gid = str(g["gift_id"])
            demo = run_gift_demo(ROOT_DIR, gid)
            self.assertIsNotNone(demo, f"Failed running gift demo for {gid}")
            self.assertEqual(demo["gift_id"], gid)

    def test_cli_gifts_subcommand_json(self) -> None:
        proc = subprocess.run(
            [os.path.join(ROOT_DIR, "bin", "cle"), "gifts", "--run", "spatial-3d-manifold-auditor", "--json"],
            text=True,
            capture_output=True,
            check=True,
        )
        payload = json.loads(proc.stdout)
        self.assertEqual(payload["gift_id"], "spatial-3d-manifold-auditor")
        self.assertTrue(payload["result"]["is_watertight_manifold"])


if __name__ == "__main__":
    unittest.main()
