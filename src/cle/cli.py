"""Command-line interface for Creative Liberation Engine (`cle`)."""

import argparse
import json
import os
import sys
from typing import List, Optional

from cle.config import load_config
from cle.kernel import collect_status, run_doctor
from cle.pipeline import run_pipeline
from cle.skills import discover_skills, get_skill
from cle.workspace import init_workspace


def _resolve_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cle",
        description="Creative Liberation Engine — Unix-native creative workflow skeleton",
    )
    sub = parser.add_subparsers(dest="command")

    status_p = sub.add_parser("status", help="Show engine configuration and loaded skills")
    status_p.add_argument("--json", action="store_true", help="Emit JSON output")

    doctor_p = sub.add_parser("doctor", help="Verify POSIX layout and runtime health")
    doctor_p.add_argument("--json", action="store_true", help="Emit JSON output")

    skills_p = sub.add_parser("skills", help="List or inspect plain-text skills")
    skills_p.add_argument("--show", metavar="NAME", help="Display full SKILL.md details")
    skills_p.add_argument("--json", action="store_true", help="Emit JSON output")

    pipe_p = sub.add_parser("pipe", help="Read prompt from stdin (or --input) and run pipeline stages")
    pipe_p.add_argument("-i", "--input", help="Input text (reads from stdin if omitted)")
    pipe_p.add_argument(
        "-s",
        "--stages",
        help="Comma-separated stages (default: ideate,plan,transform,verify)",
    )
    pipe_p.add_argument("--json", action="store_true", help="Emit JSON output")

    run_p = sub.add_parser("run", help="Run a single task string through the pipeline")
    run_p.add_argument("task", nargs="+", help="Task description")
    run_p.add_argument("-s", "--stages", help="Comma-separated stages")
    run_p.add_argument("--json", action="store_true", help="Emit JSON output")

    init_p = sub.add_parser("init", help="Scaffold a new Unix project workspace")
    init_p.add_argument("target", help="Target directory path")
    init_p.add_argument(
        "-d", "--description", default="Creative Liberation Engine Workspace", help="Workspace description"
    )
    init_p.add_argument("--json", action="store_true", help="Emit JSON output")

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.command:
        parser.print_help()
        return 0

    root_dir = _resolve_root()
    config = load_config(root_dir)

    if args.command == "status":
        data = collect_status(config)
        if args.json:
            print(json.dumps(data, indent=2))
        else:
            print(f"Creative Liberation Engine v{data['version']}")
            print(f"  Mode:           {data['mode']}")
            print(f"  Provider:       {data['provider']} ({data['model']})")
            print(f"  Default Stages: {', '.join(data['default_stages'])}")
            print(f"  Skills Loaded:  {data['skills_loaded']} ({', '.join(data['skills'])})")
        return 0

    if args.command == "doctor":
        report = run_doctor(root_dir, config)
        if args.json:
            print(json.dumps(report, indent=2))
        else:
            state = "OK" if report["healthy"] else "FAILED"
            print(f"CLE Doctor: {state}")
            for k, ok in report["checks"].items():
                mark = "[PASS]" if ok else "[FAIL]"
                print(f"  {mark} {k}")
        return 0 if report["healthy"] else 1

    if args.command == "skills":
        if args.show:
            spec = get_skill(config.skills_dir, args.show)
            if not spec:
                sys.stderr.write(f"Skill not found: {args.show}\n")
                return 1
            if args.json:
                print(json.dumps(spec.__dict__, indent=2))
            else:
                print(f"Skill: {spec.name} (stage={spec.stage})")
                print(f"Description: {spec.description}")
                print(f"Path: {spec.path}\n")
                print(spec.body)
            return 0

        specs = discover_skills(config.skills_dir)
        if args.json:
            print(json.dumps([s.__dict__ for s in specs], indent=2))
        else:
            for s in specs:
                print(f"{s.name:<12} {s.description}")
        return 0

    if args.command in ("pipe", "run"):
        if args.command == "run":
            text = " ".join(args.task)
        else:
            text = args.input if args.input is not None else sys.stdin.read()

        stages = (
            [s.strip() for s in args.stages.split(",") if s.strip()]
            if args.stages
            else None
        )
        result = run_pipeline(text, config, stages=stages)
        if args.json:
            print(json.dumps(result.to_dict(), indent=2))
        else:
            sys.stdout.write(result.format_text())
        return 0

    if args.command == "init":
        try:
            info = init_workspace(args.target, description=args.description)
        except FileExistsError as exc:
            sys.stderr.write(f"Error: {exc}\n")
            return 1
        if args.json:
            print(json.dumps(info, indent=2))
        else:
            print(f"Initialized workspace at {info['path']}")
        return 0

    return 0
