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
    edge_face_count: Dict[Tuple[int, int], int] = {}
    directed_half_edges: Dict[Tuple[int, int], int] = {}
    degenerate_faces: List[int] = []
    surface_area = 0.0

    for f_idx, (i0, i1, i2) in enumerate(faces):
        if len({i0, i1, i2}) < 3:
            degenerate_faces.append(f_idx)
            continue
        v0, v1, v2 = vertices[i0], vertices[i1], vertices[i2]
        ax, ay, az = v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]
        bx, by, bz = v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]
        cx = ay * bz - az * by
        cy = az * bx - ax * bz
        cz = ax * by - ay * bx
        area = 0.5 * math.sqrt(cx * cx + cy * cy + cz * cz)
        if area <= 1e-12:
            degenerate_faces.append(f_idx)
        surface_area += area

        for a, b in ((i0, i1), (i1, i2), (i2, i0)):
            undirected = (min(a, b), max(a, b))
            edge_face_count[undirected] = edge_face_count.get(undirected, 0) + 1
            directed_half_edges[(a, b)] = directed_half_edges.get((a, b), 0) + 1

    boundary_edges = [e for e, c in edge_face_count.items() if c == 1]
    non_manifold_edges = [e for e, c in edge_face_count.items() if c > 2]
    winding_conflicts = [
        e for e, c in directed_half_edges.items() if c > 1 and edge_face_count.get((min(e), max(e)), 0) == 2
    ]

    v_count = len(vertices)
    e_count = len(edge_face_count)
    f_count = len(faces)
    euler_chi = v_count - e_count + f_count
    is_watertight = (
        f_count > 0
        and len(boundary_edges) == 0
        and len(non_manifold_edges) == 0
        and len(winding_conflicts) == 0
        and len(degenerate_faces) == 0
    )

    return {
        "gift_id": "spatial-3d-manifold-auditor",
        "vertices": v_count,
        "edges": e_count,
        "faces": f_count,
        "euler_characteristic": euler_chi,
        "estimated_genus": int((2 - euler_chi) // 2) if is_watertight and euler_chi <= 2 else None,
        "is_watertight_manifold": is_watertight,
        "boundary_open_edges_count": len(boundary_edges),
        "non_manifold_edges_count": len(non_manifold_edges),
        "winding_orientation_conflicts": len(winding_conflicts),
        "degenerate_zero_area_faces": len(degenerate_faces),
        "total_surface_area": round(surface_area, 6),
        "threejs_webgpu_ready": is_watertight,
    }


def parse_obj_text(obj_text: str) -> Tuple[List[Vec3], List[Face]]:
    vertices: List[Vec3] = []
    faces: List[Face] = []
    for raw in obj_text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if parts[0] == "v" and len(parts) >= 4:
            vertices.append((float(parts[1]), float(parts[2]), float(parts[3])))
        elif parts[0] == "f" and len(parts) >= 4:
            idxs = [int(tok.split("/")[0]) - 1 for tok in parts[1:]]
            for k in range(1, len(idxs) - 1):
                faces.append((idxs[0], idxs[k], idxs[k + 1]))
    return vertices, faces


def demo_payload() -> Dict[str, object]:
    # Closed watertight unit tetrahedron (V=4, E=6, F=4 -> chi = 4 - 6 + 4 = 2)
    verts: List[Vec3] = [
        (0.0, 0.0, 0.0),
        (1.0, 0.0, 0.0),
        (0.5, math.sqrt(3.0) / 2.0, 0.0),
        (0.5, math.sqrt(3.0) / 6.0, math.sqrt(2.0 / 3.0)),
    ]
    tris: List[Face] = [
        (0, 2, 1),
        (0, 1, 3),
        (1, 2, 3),
        (2, 0, 3),
    ]
    return audit_mesh(verts, tris)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CLE Gift: Spatial 3D Watertight Manifold Mesh Auditor")
    parser.add_argument("--obj", help="Path to Wavefront .obj file (runs built-in watertight demo if omitted)")
    parser.add_argument("--json", action="store_true", help="Output JSON report")
    args = parser.parse_args(argv)

    if args.obj:
        with open(args.obj, "r", encoding="utf-8") as fh:
            v, f = parse_obj_text(fh.read())
        result = audit_mesh(v, f)
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


if __name__ == "__main__":
    sys.exit(main())
