#!/usr/bin/env python3
"""
Creative Liberation Engine — Gaussian Splatting Trainer
=============================================
Wraps 3D Gaussian Splatting (3DGS) training for venue scans.
Designed to run on the workstation (RTX 4090) with results
pushed back to NAS.

Supports input from:
  - Scanniverse exports (images + point cloud)
  - 360 camera equirectangular photos
  - Standard photo sets with COLMAP SfM

Prerequisites:
  pip install gsplat nerfstudio
  OR clone https://github.com/graphdeco-inria/gaussian-splatting

Usage:
    python splat_trainer.py --input /path/to/venue/room/_raw
    python splat_trainer.py --input /path --method nerfstudio
    python splat_trainer.py --input /path --method inria --iterations 30000
"""
import argparse, json, logging, os, shutil, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

# Add COLMAP to PATH globally so Nerfstudio commands can find it
colmap_paths = r"C:\Tools\COLMAP\COLMAP-3.9.1-windows-cuda;C:\Tools\COLMAP\COLMAP-3.9.1-windows-cuda\bin"
os.environ["PATH"] = f"{os.environ.get('PATH', '')};{colmap_paths}"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("splat-trainer")

NAS_VENUES = r"\\127.0.0.1\The Vault\Creative Liberation Engine\Venues"
COLMAP_BIN = shutil.which("colmap")
IMAGE_EXTS = {".jpg",".jpeg",".png",".webp",".heic",".tif",".tiff"}

# ---------------------------------------------------------------------------
# Input Preparation
# ---------------------------------------------------------------------------
def find_images(input_dir: Path) -> list[Path]:
    """Find all image files recursively."""
    imgs = []
    for f in input_dir.rglob("*"):
        if f.suffix.lower() in IMAGE_EXTS and f.is_file():
            imgs.append(f)
    return sorted(imgs)

def find_video(input_dir: Path) -> Path | None:
    """Find a video file in the input directory."""
    for ext in (".mp4", ".mov", ".mkv"):
        for f in input_dir.rglob(f"*{ext}"):
            return f
    return None

def find_pointcloud(input_dir: Path) -> Path | None:
    for ext in (".ply",".las",".laz"):
        for f in input_dir.rglob(f"*{ext}"):
            return f
    return None

def prepare_colmap_workspace(input_dir: Path, work_dir: Path):
    """Set up COLMAP workspace from raw images for SfM."""
    img_dir = work_dir / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    images = find_images(input_dir)
    if not images:
        raise ValueError(f"No images found in {input_dir}")
    logger.info(f"Found {len(images)} images")
    for img in images:
        dst = img_dir / img.name
        if not dst.exists():
            shutil.copy2(img, dst)
    return img_dir, images

def run_colmap_sfm(work_dir: Path, img_dir: Path):
    """Run COLMAP Structure-from-Motion pipeline."""
    if not COLMAP_BIN:
        raise RuntimeError("COLMAP not found. Install: https://colmap.github.io/")
    db_path = work_dir / "database.db"
    sparse_dir = work_dir / "sparse"; sparse_dir.mkdir(exist_ok=True)
    # Feature extraction
    logger.info("COLMAP: Feature extraction...")
    subprocess.run([COLMAP_BIN, "feature_extractor",
        "--database_path", str(db_path),
        "--image_path", str(img_dir),
        "--ImageReader.single_camera", "1",
        "--ImageReader.camera_model", "OPENCV",
    ], check=True)
    # Feature matching
    logger.info("COLMAP: Feature matching...")
    subprocess.run([COLMAP_BIN, "exhaustive_matcher",
        "--database_path", str(db_path),
    ], check=True)
    # Sparse reconstruction
    logger.info("COLMAP: Sparse reconstruction...")
    subprocess.run([COLMAP_BIN, "mapper",
        "--database_path", str(db_path),
        "--image_path", str(img_dir),
        "--output_path", str(sparse_dir),
    ], check=True)
    return sparse_dir

# ---------------------------------------------------------------------------
# Training Methods
# ---------------------------------------------------------------------------
def train_inria(work_dir: Path, iterations: int = 30000, output_dir: Path = None):
    """Train using original INRIA 3D Gaussian Splatting."""
    gs_repo = Path(os.environ.get("GAUSSIAN_SPLATTING_PATH",
                   str(Path.home() / "gaussian-splatting")))
    if not gs_repo.exists():
        raise RuntimeError(
            f"INRIA 3DGS repo not found at {gs_repo}. "
            "Clone https://github.com/graphdeco-inria/gaussian-splatting "
            "or set GAUSSIAN_SPLATTING_PATH env var."
        )
    train_script = gs_repo / "train.py"
    out = output_dir or work_dir / "output"
    logger.info(f"Training INRIA 3DGS: {iterations} iterations")
    subprocess.run([
        sys.executable, str(train_script),
        "-s", str(work_dir),
        "--iterations", str(iterations),
        "--model_path", str(out),
    ], check=True)
    return out

def train_nerfstudio(work_dir: Path, output_dir: Path = None, video_path: Path = None):
    """Train using Nerfstudio's splatfacto method."""
    out = output_dir or work_dir / "output"
    logger.info("Training Nerfstudio splatfacto...")
    
    # Process data first (Video or Images)
    if video_path:
        ns_proc = str(Path(sys.executable).parent / "Scripts" / "ns-process-data.exe")
        logger.info(f"Processing video with Nerfstudio: {video_path}")
        cmd = [
            f'"{ns_proc}"', "video",
            "--data", f'"{video_path}"',
            "--output-dir", f'"{work_dir / "ns_processed"}"',
        ]
        subprocess.run(" ".join(cmd), check=True, shell=True)
    else:
        ns_proc = str(Path(sys.executable).parent / "Scripts" / "ns-process-data.exe")
        logger.info("Processing images with Nerfstudio...")
        cmd = [
            f'"{ns_proc}"', "images",
            "--data", f'"{work_dir / "images"}"',
            "--output-dir", f'"{work_dir / "ns_processed"}"',
        ]
        subprocess.run(" ".join(cmd), check=True, shell=True)

    # Train
    ns_train = str(Path(sys.executable).parent / "Scripts" / "ns-train.exe")
    cmd = [
        f'"{ns_train}"', "splatfacto",
        "--data", f'"{work_dir / "ns_processed"}"',
        "--output-dir", f'"{out}"',
        "--max-num-iterations", "30000",
    ]
    subprocess.run(" ".join(cmd), check=True, shell=True)
    return out

# ---------------------------------------------------------------------------
# Export & Push
# ---------------------------------------------------------------------------
def export_splat(output_dir: Path, export_path: Path):
    """Export trained model to .ply splat format."""
    # Look for the trained point cloud
    for candidate in output_dir.rglob("point_cloud*.ply"):
        export_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(candidate, export_path)
        logger.info(f"Exported splat: {export_path}")
        return export_path
    logger.warning("No splat .ply found in output")
    return None

def push_to_nas(local_path: Path, venue_id: str, room_id: str):
    """Copy processed splat to NAS venue directory."""
    nas_dest = Path(NAS_VENUES) / venue_id / "_processed" / "splat"
    nas_dest.mkdir(parents=True, exist_ok=True)
    dst = nas_dest / f"{room_id}-splat.ply"
    shutil.copy2(local_path, dst)
    logger.info(f"Pushed to NAS: {dst}")
    return dst

# ---------------------------------------------------------------------------
# Main Pipeline
# ---------------------------------------------------------------------------
def run_pipeline(input_dir: Path, method: str = "inria",
                 iterations: int = 30000, venue_id: str = None,
                 room_id: str = None):
    """Full pipeline: prepare → SfM → train → export."""
    import tempfile
    
    # We use a local temp directory to avoid network I/O slowdowns
    # and COLMAP bugs regarding spaces in path names!
    temp_prefix = tempfile.gettempdir()
    work_dir = Path(temp_prefix) / f"splat_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    work_dir.mkdir(parents=True, exist_ok=True)
    
    # For user visibility, we also keep the original output dir pointing to the venue
    final_dir = input_dir / "_splat_workspace"
    final_dir.mkdir(exist_ok=True)
    output_dir = work_dir / "output"

    logger.info(f"=== Gaussian Splatting Pipeline ===")
    logger.info(f"Input: {input_dir}")
    logger.info(f"Method: {method}")
    logger.info(f"Local Work Dir: {work_dir}")

    # Step 1: Check for video vs images
    video_path = find_video(input_dir)
    images = []
    if video_path:
        logger.info(f"Found video input: {video_path}. Bypassing COLMAP for Nerfstudio extraction.")
    else:
        img_dir, images = prepare_colmap_workspace(input_dir, work_dir)
        logger.info(f"Prepared {len(images)} images")

    # Step 2: Check for existing point cloud (skip COLMAP if Scanniverse PLY exists)
    existing_pc = find_pointcloud(input_dir)
    if existing_pc:
        logger.info(f"Found existing point cloud: {existing_pc} — can skip full COLMAP")

    # Step 3: Run COLMAP SfM (required for camera poses if not using video in nerfstudio)
    if not video_path:
        if COLMAP_BIN:
            run_colmap_sfm(work_dir, img_dir)
        else:
            logger.warning("COLMAP not installed — will attempt training without SfM")

    # Step 4: Train
    if method == "nerfstudio":
        output_dir = train_nerfstudio(work_dir, output_dir, video_path)
    else:
        output_dir = train_inria(work_dir, iterations, output_dir)

    # Step 5: Export
    splat_path = work_dir / f"{room_id or 'scene'}-splat.ply"
    exported = export_splat(output_dir, splat_path)

    # Step 6: Push to NAS
    if exported and venue_id and room_id:
        push_to_nas(exported, venue_id, room_id)

    result = {
        "status": "complete",
        "method": method,
        "image_count": len(images),
        "output_dir": str(output_dir),
        "splat_path": str(exported) if exported else None,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    result_path = work_dir / "training_result.json"
    result_path.write_text(json.dumps(result, indent=2), "utf-8")
    logger.info(f"=== Training Complete ===")
    return result

def main():
    p = argparse.ArgumentParser(description="Venue Gaussian Splatting Trainer")
    p.add_argument("--input", required=True, help="Path to raw scan directory")
    p.add_argument("--method", default="inria", choices=["inria","nerfstudio"])
    p.add_argument("--iterations", type=int, default=30000)
    p.add_argument("--venue-id", help="Venue ID for NAS push")
    p.add_argument("--room-id", help="Room ID for NAS push")
    args = p.parse_args()
    run_pipeline(Path(args.input), args.method, args.iterations,
                 args.venue_id, args.room_id)

if __name__ == "__main__": main()
