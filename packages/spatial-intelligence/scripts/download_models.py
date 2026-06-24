#!/usr/bin/env python3
"""Download model weights via huggingface_hub."""
import argparse, logging, sys
from pathlib import Path

MODELS = {
    "utonia": {"repo": "Pointcept/Utonia", "desc": "Utonia PTv3 (549MB)"},
    "da3": {"repo": "depth-anything/DA3MONO-LARGE", "desc": "DA3 (335MB)"},
    "depthpro": {"repo": "apple/DepthPro-hf", "desc": "DepthPro (192MB)"},
}

def download(name, out, force=False):
    from huggingface_hub import snapshot_download
    dest = out / name
    if dest.exists() and not force:
        print(f"[{name}] exists, skip"); return True
    print(f"[{name}] downloading {MODELS[name]['desc']}...")
    snapshot_download(repo_id=MODELS[name]["repo"], local_dir=str(dest), local_dir_use_symlinks=False)
    return True

def validate(name, out):
    dest = out / name
    if not dest.exists(): return False
    files = [f for f in dest.rglob("*") if f.is_file()]
    sz = sum(f.stat().st_size for f in files)
    print(f"[{name}] {len(files)} files, {sz/1e6:.0f}MB")
    return len(files) > 0

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    p = argparse.ArgumentParser()
    p.add_argument("--models", nargs="+", default=["all"])
    p.add_argument("--output-dir", type=Path, default=Path(__file__).parent.parent / "models")
    p.add_argument("--force", action="store_true")
    a = p.parse_args()
    a.output_dir.mkdir(parents=True, exist_ok=True)
    names = list(MODELS) if "all" in a.models else a.models
    ok = all(download(n, a.output_dir, a.force) and validate(n, a.output_dir) for n in names)
    sys.exit(0 if ok else 1)
