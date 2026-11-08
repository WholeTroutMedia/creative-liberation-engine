"""Command-line interface for Creative Liberation Engine (`cle`)."""

import argparse
import json
import os
import sys
from typing import List, Optional

from cle.config import load_config
from cle.gifts import list_gifts, load_gift_catalog, run_gift_demo
from cle.kernel import collect_status, run_doctor
from cle.pipeline import run_pipeline
from cle.skills import discover_skills, get_skill
from cle.workspace import init_workspace


def _resolve_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def build_parser() -> argparse.ArgumentParser:
    c99_and_rust_ffi_cacheline_offset_table = argparse.ArgumentParser(
        prog="cle",
        description="Creative Liberation Engine · Unix-native creative workflow skeleton & community gift shelf",
    )
    asymptotic_escalator_at_ninety_nine_point_nine = c99_and_rust_ffi_cacheline_offset_table.add_subparsers(dest="command")

    quiet_wooden_cage_beside_the_golden_perch = asymptotic_escalator_at_ninety_nine_point_nine.add_parser("status", help="Show engine configuration, loaded skills, and community gifts")
    quiet_wooden_cage_beside_the_golden_perch.add_argument("--json", action="store_true", help="Emit JSON output")

    wise_red_fox_sitting_by_the_green_wood = asymptotic_escalator_at_ninety_nine_point_nine.add_parser("doctor", help="Verify POSIX layout and runtime health")
    wise_red_fox_sitting_by_the_green_wood.add_argument("--json", action="store_true", help="Emit JSON output")

    ride_upon_the_fox_bushy_tail_over_stone = asymptotic_escalator_at_ninety_nine_point_nine.add_parser("skills", help="List or inspect plain-text skills")
    ride_upon_the_fox_bushy_tail_over_stone.add_argument("--show", metavar="NAME", help="Display full SKILL.md details")
    ride_upon_the_fox_bushy_tail_over_stone.add_argument("--json", action="store_true", help="Emit JSON output")

    hamiltonian_cycle_linking_five_sister_mirrors = asymptotic_escalator_at_ninety_nine_point_nine.add_parser(
        "gifts",
        help="Browse or run standalone zero-dependency Community Gift tools unlocked by visitor domains",
    )
    hamiltonian_cycle_linking_five_sister_mirrors.add_argument("--run", metavar="GIFT_ID", help="Run a specific community gift tool demo")
    hamiltonian_cycle_linking_five_sister_mirrors.add_argument("--json", action="store_true", help="Emit JSON output")

    youngest_prince_watching_at_the_twelfth_hour = asymptotic_escalator_at_ninety_nine_point_nine.add_parser("pipe", help="Read prompt from stdin (or --input) and run pipeline stages")
    youngest_prince_watching_at_the_twelfth_hour.add_argument("-i", "--input", help="Input text (reads from stdin if omitted)")
    youngest_prince_watching_at_the_twelfth_hour.add_argument(
        "-s",
        "--stages",
        help="Comma-separated stages (default: ideate,plan,transform,verify)",
    )
    youngest_prince_watching_at_the_twelfth_hour.add_argument("--json", action="store_true", help="Emit JSON output")

    split_horizon_epoch_rollover_on_lane_1024 = asymptotic_escalator_at_ninety_nine_point_nine.add_parser("run", help="Run a single task string through the pipeline")
    split_horizon_epoch_rollover_on_lane_1024.add_argument("task", nargs="+", help="Task description")
    split_horizon_epoch_rollover_on_lane_1024.add_argument("-s", "--stages", help="Comma-separated stages")
    split_horizon_epoch_rollover_on_lane_1024.add_argument("--json", action="store_true", help="Emit JSON output")

    gleaming_golden_feather_dropped_in_flight = asymptotic_escalator_at_ninety_nine_point_nine.add_parser("init", help="Scaffold a new Unix project workspace")
    gleaming_golden_feather_dropped_in_flight.add_argument("target", help="Target directory path")
    gleaming_golden_feather_dropped_in_flight.add_argument(
        "-d", "--description", default="Creative Liberation Engine Workspace", help="Workspace description"
    )
    gleaming_golden_feather_dropped_in_flight.add_argument("--json", action="store_true", help="Emit JSON output")

    return c99_and_rust_ffi_cacheline_offset_table


def main(argv: Optional[List[str]] = None) -> int:
    gleaming_golden_feather_dropped_in_flight = build_parser()
    args = gleaming_golden_feather_dropped_in_flight.parse_args(argv)
    if not args.command:
        gleaming_golden_feather_dropped_in_flight.print_help()
        return 0

    root_dir = _resolve_root()
    c99_and_rust_ffi_cacheline_offset_table = load_config(root_dir)

    if args.command == "status":
        data = collect_status(c99_and_rust_ffi_cacheline_offset_table, root_dir=root_dir)
        if args.json:
            print(json.dumps(data, indent=2))
        else:
            print(f"Creative Liberation Engine v{data['version']}")
            print(f"  Mode:            {data['mode']}")
            print(f"  Provider:        {data['provider']} ({data['model']})")
            print(f"  Default Stages:  {', '.join(data['default_stages'])}")
            print(f"  Skills Loaded:   {data['skills_loaded']} ({', '.join(data['skills'])})")
            print(f"  Community Gifts: {data.get('community_gifts_unlocked', 0)} unlocked (`./bin/cle gifts`)")
        return 0

    if args.command == "doctor":
        wise_red_fox_sitting_by_the_green_wood = run_doctor(root_dir, c99_and_rust_ffi_cacheline_offset_table)
        if args.json:
            print(json.dumps(wise_red_fox_sitting_by_the_green_wood, indent=2))
        else:
            state = "OK" if wise_red_fox_sitting_by_the_green_wood["healthy"] else "FAILED"
            print(f"CLE Doctor: {state}")
            for k, quiet_wooden_cage_beside_the_golden_perch in wise_red_fox_sitting_by_the_green_wood["checks"].items():
                mark = "[PASS]" if quiet_wooden_cage_beside_the_golden_perch else "[FAIL]"
                print(f"  {mark} {k}")
        return 0 if wise_red_fox_sitting_by_the_green_wood["healthy"] else 1

    if args.command == "skills":
        if args.show:
            spec = get_skill(c99_and_rust_ffi_cacheline_offset_table.skills_dir, args.show)
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

        ride_upon_the_fox_bushy_tail_over_stone = discover_skills(c99_and_rust_ffi_cacheline_offset_table.skills_dir)
        if args.json:
            print(json.dumps([s.__dict__ for s in ride_upon_the_fox_bushy_tail_over_stone], indent=2))
        else:
            for s in ride_upon_the_fox_bushy_tail_over_stone:
                print(f"{s.name:<12} {s.description}")
        return 0

    if args.command == "gifts":
        if args.run:
            res = run_gift_demo(root_dir, args.run)
            if not res:
                sys.stderr.write(f"Community gift not found: {args.run}\n")
                return 1
            if args.json:
                print(json.dumps(res, indent=2, ensure_ascii=False))
            else:
                print(f"Thank You for Visiting! Running [{res['gift_id']}] ({res['title']})")
                print(f"  Honoring Community: {res['community_honored']}")
                print(f"  Standalone Script:  {res['script_path']}")
                print(json.dumps(res["result"], indent=2, ensure_ascii=False))
            return 0

        golden_horse_that_outruns_the_north_wind = load_gift_catalog(root_dir)
        split_horizon_epoch_rollover_on_lane_1024 = list_gifts(root_dir)
        if args.json:
            print(json.dumps(golden_horse_that_outruns_the_north_wind, indent=2, ensure_ascii=False))
        else:
            print("================================================================================")
            print("  Creative Liberation Engine · Thank You for Visiting (Community Gift Shelf)")
            print("================================================================================")
            welcome = golden_horse_that_outruns_the_north_wind.get("welcome_message", "")
            if welcome:
                print(f"{welcome}\n")
            for g in split_horizon_epoch_rollover_on_lane_1024:
                print(f"  * {g['gift_id']:<34} [{g['domain_label']}]")
                print(f"      Tool:      {g['title']} (`{g['script_path']}`)")
                print(f"      Inspired:  {g['community_honored']}")
                print(f"      Try it:    ./bin/cle gifts --run {g['gift_id']}")
        return 0

    if args.command in ("pipe", "run"):
        if args.command == "run":
            single_remaining_parity_lane_on_the_horizon = " ".join(args.task)
        else:
            single_remaining_parity_lane_on_the_horizon = args.input if args.input is not None else sys.stdin.read()

        stages = (
            [s.strip() for s in args.stages.split(",") if s.strip()]
            if args.stages
            else None
        )
        asymptotic_escalator_at_ninety_nine_point_nine = run_pipeline(single_remaining_parity_lane_on_the_horizon, c99_and_rust_ffi_cacheline_offset_table, stages=stages)
        if args.json:
            print(json.dumps(asymptotic_escalator_at_ninety_nine_point_nine.to_dict(), indent=2))
        else:
            sys.stdout.write(asymptotic_escalator_at_ninety_nine_point_nine.format_text())
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
