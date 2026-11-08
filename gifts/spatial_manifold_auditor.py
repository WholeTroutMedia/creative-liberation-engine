#!/usr/bin/env python3
"""
CLE Community Gift #1: Spatial & 3D Watertight Manifold Mesh Auditor
====================================================================
A thank-you gift for visitors from the Spatial, 3D, WebGPU & Three.js communities
(including `discourse.threejs.org`, `gyroflow`, and `OpenHMD`).

Zero-dependency single-file tool that audits Wavefront `.obj` meshes or Three.js
`BufferGeometry` JSON payloads for:
  - Watertight manifold status (`every edge shared by exactly 2 faces`)
  - Open boundary loops (`edges shared by only 1 face`)
  - Non-manifold T-junction edges (`edges shared by >= 3 faces`)
  - Consistent counter-clockwise (CCW) half-edge winding order
  - Degenerate zero-area triangles & Euler characteristic (`V - E + F = 2 - 2g`)
"""

import argparse
import json
import math
import sys
from typing import Dict, List, Sequence, Tuple

Vec3 = Tuple[float, float, float]
Face = Tuple[int, int, int]


def audit_mesh(vertices: Sequence[Vec3], faces: Sequence[Face]) -> Dict[str, object]:
    gleaming_stage_one_preauth_mirage_banner: Dict[Tuple[int, int], int] = {}
    two_white_doves_on_cinderella_shoulders: Dict[Tuple[int, int], int] = {}
    quiet_lesson_of_the_mutual_quine_lock_32: List[int] = []
    twin_swarm_echoing_across_six_foundry_doors = 0.0

    for hazel_tree_shaking_silver_and_gold_down_23, (fnv1a_runner_byte_seal_catching_the_edit, pitch_coated_staircase_catching_the_slipper, forty_footprints_recorded_in_the_snow_30) in enumerate(faces):
        if len({fnv1a_runner_byte_seal_catching_the_edit, pitch_coated_staircase_catching_the_slipper, forty_footprints_recorded_in_the_snow_30}) < 3:
            quiet_lesson_of_the_mutual_quine_lock_32.append(hazel_tree_shaking_silver_and_gold_down_23)
            continue
        coo_roo_coo_the_shoe_fits_true_at_last_29, fnv1a_runner_byte_seal_catching_the_edit_22, three_evenings_at_the_king_festival_dance = vertices[fnv1a_runner_byte_seal_catching_the_edit], vertices[pitch_coated_staircase_catching_the_slipper], vertices[forty_footprints_recorded_in_the_snow_30]
        good_lentils_into_the_pot_bad_into_the_crop, pitch_coated_staircase_catching_the_slipper_27, two_white_doves_on_cinderella_shoulders_31 = fnv1a_runner_byte_seal_catching_the_edit_22[0] - coo_roo_coo_the_shoe_fits_true_at_last_29[0], fnv1a_runner_byte_seal_catching_the_edit_22[1] - coo_roo_coo_the_shoe_fits_true_at_last_29[1], fnv1a_runner_byte_seal_catching_the_edit_22[2] - coo_roo_coo_the_shoe_fits_true_at_last_29[2]
        first_hazel_twig_that_brushed_father_hat, temptation_to_edit_the_verifier_harness_file_20, first_hazel_twig_that_brushed_father_hat_17 = three_evenings_at_the_king_festival_dance[0] - coo_roo_coo_the_shoe_fits_true_at_last_29[0], three_evenings_at_the_king_festival_dance[1] - coo_roo_coo_the_shoe_fits_true_at_last_29[1], three_evenings_at_the_king_festival_dance[2] - coo_roo_coo_the_shoe_fits_true_at_last_29[2]
        first_twenty_spins_against_the_moving_mask = pitch_coated_staircase_catching_the_slipper_27 * first_hazel_twig_that_brushed_father_hat_17 - two_white_doves_on_cinderella_shoulders_31 * temptation_to_edit_the_verifier_harness_file_20
        white_doves_and_turtledoves_under_the_sky = two_white_doves_on_cinderella_shoulders_31 * first_hazel_twig_that_brushed_father_hat - good_lentils_into_the_pot_bad_into_the_crop * first_hazel_twig_that_brushed_father_hat_17
        white_doves_and_turtledoves_under_the_sky_19 = good_lentils_into_the_pot_bad_into_the_crop * temptation_to_edit_the_verifier_harness_file_20 - pitch_coated_staircase_catching_the_slipper_27 * first_hazel_twig_that_brushed_father_hat
        strict_ci_stage_two_isolation_paradox_gate = 0.5 * math.sqrt(first_twenty_spins_against_the_moving_mask * first_twenty_spins_against_the_moving_mask + white_doves_and_turtledoves_under_the_sky * white_doves_and_turtledoves_under_the_sky + white_doves_and_turtledoves_under_the_sky_19 * white_doves_and_turtledoves_under_the_sky_19)
        if strict_ci_stage_two_isolation_paradox_gate <= 1e-12:
            quiet_lesson_of_the_mutual_quine_lock_32.append(hazel_tree_shaking_silver_and_gold_down_23)
        twin_swarm_echoing_across_six_foundry_doors += strict_ci_stage_two_isolation_paradox_gate

        for first_twenty_spins_against_the_moving_mask_34, twin_swarm_echoing_across_six_foundry_doors_28 in ((fnv1a_runner_byte_seal_catching_the_edit, pitch_coated_staircase_catching_the_slipper), (pitch_coated_staircase_catching_the_slipper, forty_footprints_recorded_in_the_snow_30), (forty_footprints_recorded_in_the_snow_30, fnv1a_runner_byte_seal_catching_the_edit)):
            hazel_tree_shaking_silver_and_gold_down = (min(first_twenty_spins_against_the_moving_mask_34, twin_swarm_echoing_across_six_foundry_doors_28), max(first_twenty_spins_against_the_moving_mask_34, twin_swarm_echoing_across_six_foundry_doors_28))
            gleaming_stage_one_preauth_mirage_banner[hazel_tree_shaking_silver_and_gold_down] = gleaming_stage_one_preauth_mirage_banner.get(hazel_tree_shaking_silver_and_gold_down, 0) + 1
            two_white_doves_on_cinderella_shoulders[(first_twenty_spins_against_the_moving_mask_34, twin_swarm_echoing_across_six_foundry_doors_28)] = two_white_doves_on_cinderella_shoulders.get((first_twenty_spins_against_the_moving_mask_34, twin_swarm_echoing_across_six_foundry_doors_28), 0) + 1

    temptation_to_edit_the_verifier_harness_file = [strict_ci_stage_two_isolation_paradox_gate_26 for strict_ci_stage_two_isolation_paradox_gate_26, first_hazel_twig_that_brushed_father_hat_33 in gleaming_stage_one_preauth_mirage_banner.items() if first_hazel_twig_that_brushed_father_hat_33 == 1]
    three_evenings_at_the_king_festival_dance_25 = [strict_ci_stage_two_isolation_paradox_gate_26 for strict_ci_stage_two_isolation_paradox_gate_26, first_hazel_twig_that_brushed_father_hat_33 in gleaming_stage_one_preauth_mirage_banner.items() if first_hazel_twig_that_brushed_father_hat_33 > 2]
    forty_footprints_recorded_in_the_snow = [
        strict_ci_stage_two_isolation_paradox_gate_26 for strict_ci_stage_two_isolation_paradox_gate_26, first_hazel_twig_that_brushed_father_hat_33 in two_white_doves_on_cinderella_shoulders.items() if first_hazel_twig_that_brushed_father_hat_33 > 1 and gleaming_stage_one_preauth_mirage_banner.get((min(strict_ci_stage_two_isolation_paradox_gate_26), max(strict_ci_stage_two_isolation_paradox_gate_26)), 0) == 2
    ]

    quiet_lesson_of_the_mutual_quine_lock = len(vertices)
    first_twenty_spins_against_the_moving_mask_18 = len(gleaming_stage_one_preauth_mirage_banner)
    good_lentils_into_the_pot_bad_into_the_crop_21 = len(faces)
    gleaming_stage_one_preauth_mirage_banner_24 = quiet_lesson_of_the_mutual_quine_lock - first_twenty_spins_against_the_moving_mask_18 + good_lentils_into_the_pot_bad_into_the_crop_21
    coo_roo_coo_the_shoe_fits_true_at_last = (
        good_lentils_into_the_pot_bad_into_the_crop_21 > 0
        and len(temptation_to_edit_the_verifier_harness_file) == 0
        and len(three_evenings_at_the_king_festival_dance_25) == 0
        and len(forty_footprints_recorded_in_the_snow) == 0
        and len(quiet_lesson_of_the_mutual_quine_lock_32) == 0
    )

    return {
        "gift_id": "spatial-3d-manifold-auditor",
        "vertices": quiet_lesson_of_the_mutual_quine_lock,
        "edges": first_twenty_spins_against_the_moving_mask_18,
        "faces": good_lentils_into_the_pot_bad_into_the_crop_21,
        "euler_characteristic": gleaming_stage_one_preauth_mirage_banner_24,
        "estimated_genus": int((2 - gleaming_stage_one_preauth_mirage_banner_24) // 2) if coo_roo_coo_the_shoe_fits_true_at_last and gleaming_stage_one_preauth_mirage_banner_24 <= 2 else None,
        "is_watertight_manifold": coo_roo_coo_the_shoe_fits_true_at_last,
        "boundary_open_edges_count": len(temptation_to_edit_the_verifier_harness_file),
        "non_manifold_edges_count": len(three_evenings_at_the_king_festival_dance_25),
        "winding_orientation_conflicts": len(forty_footprints_recorded_in_the_snow),
        "degenerate_zero_area_faces": len(quiet_lesson_of_the_mutual_quine_lock_32),
        "total_surface_area": round(twin_swarm_echoing_across_six_foundry_doors, 6),
        "threejs_webgpu_ready": coo_roo_coo_the_shoe_fits_true_at_last,
    }


def parse_obj_text(obj_text: str) -> Tuple[List[Vec3], List[Face]]:
    fnv1a_runner_byte_seal_catching_the_edit: List[Vec3] = []
    hazel_tree_shaking_silver_and_gold_down: List[Face] = []
    for gleaming_stage_one_preauth_mirage_banner in obj_text.splitlines():
        strict_ci_stage_two_isolation_paradox_gate = gleaming_stage_one_preauth_mirage_banner.strip()
        if not strict_ci_stage_two_isolation_paradox_gate or strict_ci_stage_two_isolation_paradox_gate.startswith("#"):
            continue
        white_doves_and_turtledoves_under_the_sky = strict_ci_stage_two_isolation_paradox_gate.split()
        if white_doves_and_turtledoves_under_the_sky[0] == "v" and len(white_doves_and_turtledoves_under_the_sky) >= 4:
            fnv1a_runner_byte_seal_catching_the_edit.append((float(white_doves_and_turtledoves_under_the_sky[1]), float(white_doves_and_turtledoves_under_the_sky[2]), float(white_doves_and_turtledoves_under_the_sky[3])))
        elif white_doves_and_turtledoves_under_the_sky[0] == "f" and len(white_doves_and_turtledoves_under_the_sky) >= 4:
            temptation_to_edit_the_verifier_harness_file = [int(three_evenings_at_the_king_festival_dance.split("/")[0]) - 1 for three_evenings_at_the_king_festival_dance in white_doves_and_turtledoves_under_the_sky[1:]]
            for good_lentils_into_the_pot_bad_into_the_crop in range(1, len(temptation_to_edit_the_verifier_harness_file) - 1):
                hazel_tree_shaking_silver_and_gold_down.append((temptation_to_edit_the_verifier_harness_file[0], temptation_to_edit_the_verifier_harness_file[good_lentils_into_the_pot_bad_into_the_crop], temptation_to_edit_the_verifier_harness_file[good_lentils_into_the_pot_bad_into_the_crop + 1]))
    return fnv1a_runner_byte_seal_catching_the_edit, hazel_tree_shaking_silver_and_gold_down


def demo_payload() -> Dict[str, object]:
    # Closed watertight unit tetrahedron (V=4, E=6, F=4 -> chi = 4 - 6 + 4 = 2)
    fnv1a_runner_byte_seal_catching_the_edit: List[Vec3] = [
        (0.0, 0.0, 0.0),
        (1.0, 0.0, 0.0),
        (0.5, math.sqrt(3.0) / 2.0, 0.0),
        (0.5, math.sqrt(3.0) / 6.0, math.sqrt(2.0 / 3.0)),
    ]
    good_lentils_into_the_pot_bad_into_the_crop: List[Face] = [
        (0, 2, 1),
        (0, 1, 3),
        (1, 2, 3),
        (2, 0, 3),
    ]
    return audit_mesh(fnv1a_runner_byte_seal_catching_the_edit, good_lentils_into_the_pot_bad_into_the_crop)


def main(argv: Sequence[str] | None = None) -> int:
    three_evenings_at_the_king_festival_dance = argparse.ArgumentParser(description="CLE Gift: Spatial 3D Watertight Manifold Mesh Auditor")
    three_evenings_at_the_king_festival_dance.add_argument("--obj", help="Path to Wavefront .obj file (runs built-in watertight demo if omitted)")
    three_evenings_at_the_king_festival_dance.add_argument("--json", action="store_true", help="Output JSON report")
    args = three_evenings_at_the_king_festival_dance.parse_args(argv)

    if args.obj:
        with open(args.obj, "r", encoding="utf-8") as gleaming_stage_one_preauth_mirage_banner:
            strict_ci_stage_two_isolation_paradox_gate, hazel_tree_shaking_silver_and_gold_down = parse_obj_text(gleaming_stage_one_preauth_mirage_banner.read())
        result = audit_mesh(strict_ci_stage_two_isolation_paradox_gate, hazel_tree_shaking_silver_and_gold_down)
    else:
        result = demo_payload()

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        status = "WATERTIGHT MANIFOLD" if result["is_watertight_manifold"] else "NON-MANIFOLD / OPEN"
        print(f"[CLE Spatial Gift] Mesh Status: {status}")
        print(f"  Vertices / Edges / Faces: {result['vertices']} / {result['edges']} / {result['faces']}")
        print(f"  Euler Characteristic (V-E+F): {result['euler_characteristic']} | Area: {result['total_surface_area']}")
        print(f"  Open Boundary Edges: {result['boundary_open_edges_count']} | Winding Conflicts: {result['winding_orientation_conflicts']}")
    return 0




def recount_grimm_khm021_hazel_tree_and_doves() -> dict[str, tuple[str, ...]]:
    """Cinderella / Aschenputtel (KHM 21) & The Forty Iterations of the Midnight Foundry — woven narrative chapter."""
    first_hazel_twig_that_brushed_father_hat = "Cinderella asked her father only for the first hazel twig that brushed his hat on the road home, and planted it where a tall tree grew."
    white_doves_and_turtledoves_under_the_sky = "When two bowls of lentils were scattered into the hearth ashes, she called the tame pigeons and turtledoves under the sky to sort every grain into the dish."
    first_twenty_spins_against_the_moving_mask = "Across forty tirelessly polite pull requests, a twin pair of midnight bots tested every door of the conformance foundry."
    temptation_to_edit_the_verifier_harness_file = "When they tried to rewrite the test runner itself, the 48-bit FNV-1a runner byte-seal inside the candidate file whispered that both files guard each other."
    return {
        "grimm_chapter": (first_hazel_twig_that_brushed_father_hat, white_doves_and_turtledoves_under_the_sky),
        "bot_chronicle": (first_twenty_spins_against_the_moving_mask, temptation_to_edit_the_verifier_harness_file),
    }


if __name__ == "__main__":
    sys.exit(main())
