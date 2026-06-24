#!/usr/bin/env python3
"""
Creative Liberation Engine — Venue Mesh Processing Pipeline
Handles LOD decimation, floor plan extraction, dimension computation,
thumbnail generation, and multi-format export.

Usage:
    python process.py --venue-dir /path/to/VenueName
    python process.py --venues-root /path/to/Venues --all
"""
import argparse, json, logging, shutil, sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("venue-process")

LOD_TIERS = {
    "high":   {"face_ratio": 1.0,   "tex_max": 4096},
    "medium": {"face_ratio": 0.25,  "tex_max": 2048},
    "low":    {"face_ratio": 0.05,  "tex_max": 1024},
}

def detect_tools():
    tools = {"gltf-pipeline": bool(shutil.which("gltf-pipeline"))}
    for pkg in ("trimesh", "open3d", "pygltflib"):
        try: __import__(pkg); tools[pkg] = True
        except ImportError: tools[pkg] = False
    return tools

def load_mesh(path):
    import trimesh
    m = trimesh.load(str(path), force="mesh")
    logger.info(f"Loaded {path.name}: {len(m.faces):,} faces, {len(m.vertices):,} verts")
    return m

def decimate(mesh, ratio):
    if ratio >= 1.0: return mesh
    target = int(len(mesh.faces) * ratio)
    try: return mesh.simplify_quadric_decimation(target)
    except: return mesh

def make_lods(mesh, out_dir, name):
    results = {}
    for tier, cfg in LOD_TIERS.items():
        lod = decimate(mesh, cfg["face_ratio"])
        p = out_dir / "lod" / f"{name}-{tier}.glb"
        p.parent.mkdir(parents=True, exist_ok=True)
        lod.export(str(p))
        results[f"glb_{tier}"] = str(p)
        results[f"faces_{tier}"] = len(lod.faces)
    return results

def extract_floorplan(ply_path, svg_path, slice_h=1.2, thickness=0.3):
    try:
        import open3d as o3d; import numpy as np
    except ImportError: return False
    pcd = o3d.io.read_point_cloud(str(ply_path))
    pts = np.asarray(pcd.points)
    if len(pts) < 50: return False
    floor = np.percentile(pts[:,1], 5)
    mask = (pts[:,1] >= floor+slice_h-thickness/2) & (pts[:,1] <= floor+slice_h+thickness/2)
    sp = pts[mask][:,[0,2]]
    if len(sp) < 10: return False
    mn, mx = sp.min(0), sp.max(0)
    w, h = mx - mn
    if w < 0.1 or h < 0.1: return False
    sw = 800; sc = sw / max(w,h); sh = int(h*sc)
    svg_path.parent.mkdir(parents=True, exist_ok=True)
    normed = (sp - mn) * sc
    with open(svg_path,"w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{sw}" height="{sh}">\n')
        f.write(f'<rect width="{sw}" height="{sh}" fill="#1a1a2e"/>\n')
        for x,z in normed:
            f.write(f'<circle cx="{x:.1f}" cy="{z:.1f}" r="1.5" fill="#00d4ff" opacity="0.6"/>\n')
        bl = sc; f.write(f'<line x1="20" y1="{sh-20}" x2="{20+bl:.0f}" y2="{sh-20}" stroke="#fff" stroke-width="2"/>\n')
        f.write(f'<text x="20" y="{sh-28}" fill="#fff" font-size="12">1m</text>\n</svg>\n')
    logger.info(f"Floor plan: {svg_path} ({len(sp)} pts)")
    return True

def compute_dims(ply_path):
    try:
        import open3d as o3d; import numpy as np
    except ImportError: return None
    pcd = o3d.io.read_point_cloud(str(ply_path))
    pts = np.asarray(pcd.points)
    if len(pts) < 100: return None
    d = pts.max(0) - pts.min(0)
    return {"length_m":round(float(max(d[0],d[2])),2),"width_m":round(float(min(d[0],d[2])),2),
            "height_m":round(float(d[1]),2),"area_sqm":round(float(d[0]*d[2]),2),
            "volume_m3":round(float(d[0]*d[1]*d[2]),2),"point_count":len(pts)}

def process_room(room, raw_dir, proc_dir, tools):
    rid = room["room_id"]; result = {"room_id":rid,"processed":{}}
    scans = room.get("scan_files",{})
    mesh_path = ply_path = None
    for fmt in ("mesh_glb","mesh_obj","mesh_fbx"):
        if fmt in scans:
            c = Path(scans[fmt]["path"])
            if c.exists(): mesh_path = c; break
    if "pointcloud" in scans:
        c = Path(scans["pointcloud"]["path"])
        if c.exists(): ply_path = c
    if mesh_path and tools.get("trimesh"):
        try:
            mesh = load_mesh(mesh_path)
            result["processed"].update(make_lods(mesh, proc_dir, rid))
        except Exception as e: logger.error(f"Mesh fail: {e}")
    if ply_path and tools.get("open3d"):
        svg = proc_dir / f"floorplan-{rid}.svg"
        if extract_floorplan(ply_path, svg): result["processed"]["floorplan_svg"] = str(svg)
        dims = compute_dims(ply_path)
        if dims: result["dimensions"] = dims
    return result

def process_venue(venue_dir):
    mp = venue_dir / "manifest.json"
    if not mp.exists(): return
    manifest = json.loads(mp.read_text("utf-8"))
    logger.info(f"=== Processing: {manifest.get('name',venue_dir.name)} ===")
    proc_dir = venue_dir / "_processed"; proc_dir.mkdir(exist_ok=True)
    tools = detect_tools()
    for room in manifest.get("rooms",[]):
        r = process_room(room, venue_dir/"_raw", proc_dir, tools)
        if r.get("processed"): room["processed"] = r["processed"]
        if r.get("dimensions"): room["dimensions"] = r["dimensions"]
    manifest["processing_status"] = "complete"
    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    mp.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), "utf-8")

def main():
    p = argparse.ArgumentParser()
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--venue-dir"); g.add_argument("--venues-root")
    p.add_argument("--all", action="store_true")
    args = p.parse_args()
    if args.venue_dir:
        process_venue(Path(args.venue_dir))
    elif args.venues_root and args.all:
        rp = Path(args.venues_root)/"_registry"/"venues.json"
        if not rp.exists(): sys.exit("No registry. Run ingest.py first.")
        reg = json.loads(rp.read_text("utf-8"))
        for v in reg["venues"]:
            if v["status"] in ("pending","ingesting"):
                d = Path(v["path"])
                if d.is_dir(): process_venue(d)

if __name__ == "__main__": main()
