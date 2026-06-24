#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Creative Liberation Engine V6 — Photo Slideshow Generator
Takes a Barnstorm venue photo folder on The Vault, selects the best images,
and assembles a branded slideshow timeline in DaVinci Resolve via the bridge.

Usage:
    python slideshow_generator.py --venue "North Jersey Country Club" --year 2026
    python slideshow_generator.py --photo-path "\\\\127.0.0.1\\The Vault\\Photos\\2026\\Barnstorm\\Weddings\\North Jersey Country Club"
"""

import argparse
import json
import os
import random
import subprocess
import sys
import urllib.request
from pathlib import Path

# ─── Configuration ────────────────────────────────────────────────────────────

NAS_BASE = "W:\\" if os.path.exists("W:\\") else r"\\127.0.0.1\The Vault"
BRAND_ASSETS = {
    "logo_transparent": os.path.join(NAS_BASE, r"RAW Backups\2025\Barnstorm 2025\The Barnstorm Logo - Black Transparent.png"),
    "lut_file": os.path.join(NAS_BASE, r"RAW Backups\2025\Barnstorm 2025\Video Elements\LUTs\Barnstorm LUT V1_20.C8761S03.cube"),
}

BRIDGE_URL = "http://127.0.0.1:5105"
PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}

# Slideshow timing
SLIDE_DURATION_SEC = 4.0       # Duration per slide
TRANSITION_DURATION_SEC = 0.8  # Cross-dissolve duration between slides
MAX_SLIDES = 20                # Maximum number of slides in a reel
TARGET_FPS = 24                # Timeline framerate

# ─── Photo Scanner & Ranker ──────────────────────────────────────────────────

def scan_photos(folder_path: str) -> list[str]:
    """
    Scan a folder for photos, filter out thumbnails and metadata,
    return sorted list of full paths.
    """
    photos = []
    for root, dirs, files in os.walk(folder_path):
        # Skip Synology metadata
        dirs[:] = [d for d in dirs if d != "@eaDir"]
        
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in PHOTO_EXTENSIONS:
                full_path = os.path.join(root, f)
                # Skip thumbnails and temp files
                if "thumb" in f.lower() or f.startswith(".") or f.startswith("~"):
                    continue
                photos.append(full_path)
    
    # Sort by filename (usually chronological for numbered shoots)
    photos.sort()
    return photos


def rank_photos_by_size(photos: list[str]) -> list[str]:
    """
    Simple ranking heuristic: larger file size = higher quality / more detail.
    Returns top MAX_SLIDES photos ranked by filesize descending.
    """
    sized = []
    for p in photos:
        try:
            size = os.path.getsize(p)
            sized.append((p, size))
        except OSError:
            continue
    
    # Sort by size descending
    sized.sort(key=lambda x: x[1], reverse=True)
    
    # Take top candidates
    top = [p for p, _ in sized[:MAX_SLIDES]]
    
    # Re-sort by filename to maintain chronological flow
    top.sort(key=lambda x: os.path.basename(x))
    return top


def get_image_dimensions(image_path: str) -> tuple[int, int]:
    """Get image dimensions using FFprobe."""
    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=p=0:s=x",
        image_path
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        parts = result.stdout.strip().split("x")
        return int(parts[0]), int(parts[1])
    except Exception:
        return 0, 0


# ─── Bridge Communication ────────────────────────────────────────────────────

def send_to_bridge(endpoint: str, payload: dict) -> dict:
    """Send a JSON request to the DaVinci Resolve Bridge."""
    url = f"{BRIDGE_URL}{endpoint}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}


def check_bridge_health() -> bool:
    """Verify the DaVinci Resolve Bridge is running."""
    try:
        req = urllib.request.Request(f"{BRIDGE_URL}/health")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("status") in ("healthy", "degraded")
    except Exception:
        return False


# ─── Slideshow Assembly ──────────────────────────────────────────────────────

def generate_slideshow_edl(photos: list[str]) -> list[dict]:
    """
    Generate a slideshow EDL for the bridge.
    Each photo becomes a still clip on the timeline.
    """
    edl = []
    frames_per_slide = int(SLIDE_DURATION_SEC * TARGET_FPS)
    
    for i, photo_path in enumerate(photos):
        edl.append({
            "filePath": photo_path,
            "startFrame": 0,
            "endFrame": frames_per_slide,
            "slideIndex": i + 1,
            "isStill": True
        })
    
    return edl


def create_ffmpeg_slideshow(photos: list[str], output_path: str, venue_name: str) -> bool:
    """
    Fallback: Use FFmpeg to directly create a slideshow video with Ken Burns effect.
    This works even without DaVinci Resolve.
    """
    if not photos:
        return False
    
    # Build FFmpeg input args
    input_args = []
    filter_parts = []
    
    for i, photo in enumerate(photos):
        input_args.extend(["-loop", "1", "-t", str(SLIDE_DURATION_SEC), "-i", photo])
        # Scale to 1080x1920 (9:16 vertical) with padding, then add subtle zoom
        filter_parts.append(
            f"[{i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,"
            f"pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,"
            f"zoompan=z='min(zoom+0.0015,1.3)':d={int(SLIDE_DURATION_SEC * TARGET_FPS)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920,"
            f"fade=t=in:st=0:d={TRANSITION_DURATION_SEC}:alpha=1,"
            f"fade=t=out:st={SLIDE_DURATION_SEC - TRANSITION_DURATION_SEC}:d={TRANSITION_DURATION_SEC}:alpha=1"
            f"[v{i}]"
        )
    
    # Concat all slides
    concat_input = "".join(f"[v{i}]" for i in range(len(photos)))
    filter_complex = ";".join(filter_parts) + f";{concat_input}concat=n={len(photos)}:v=1:a=0[outv]"
    
    cmd = (
        ["ffmpeg", "-y"] + input_args +
        ["-filter_complex", filter_complex,
         "-map", "[outv]",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18",
         "-pix_fmt", "yuv420p",
         "-r", str(TARGET_FPS),
         output_path]
    )
    
    print(f"  Running FFmpeg slideshow render ({len(photos)} slides)...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode == 0:
            print(f"  [OK] Rendered to: {output_path}")
            return True
        else:
            print(f"  [ERROR] FFmpeg failed: {result.stderr[-500:]}")
            return False
    except Exception as e:
        print(f"  [ERROR] FFmpeg execution failed: {e}")
        return False


# ─── Main Pipeline ───────────────────────────────────────────────────────────

def run_pipeline(photo_path: str, venue_name: str, use_ffmpeg_fallback: bool = False):
    """Execute the slideshow generation pipeline."""
    
    print(f"\n{'='*60}")
    print(f"  BARNSTORM SLIDESHOW GENERATOR")
    print(f"  Venue: {venue_name}")
    print(f"  Path:  {photo_path}")
    print(f"{'='*60}\n")
    
    # Step 1: Scan photos
    print("[1/4] Scanning photo folder...")
    all_photos = scan_photos(photo_path)
    print(f"  Found {len(all_photos)} photos")
    
    if not all_photos:
        print("  [ERROR] No photos found.")
        sys.exit(1)
    
    # Step 2: Rank and select best photos
    print("\n[2/4] Ranking and selecting top photos...")
    selected = rank_photos_by_size(all_photos)
    print(f"  Selected {len(selected)} photos for slideshow")
    
    for i, p in enumerate(selected[:5]):
        w, h = get_image_dimensions(p)
        size_mb = os.path.getsize(p) / (1024 * 1024)
        print(f"    {i+1}. {os.path.basename(p)} ({w}x{h}, {size_mb:.1f}MB)")
    if len(selected) > 5:
        print(f"    ... and {len(selected) - 5} more")
    
    # Step 3: Generate EDL
    print(f"\n[3/4] Generating slideshow EDL...")
    edl = generate_slideshow_edl(selected)
    total_duration = len(selected) * SLIDE_DURATION_SEC
    print(f"  {len(edl)} slides x {SLIDE_DURATION_SEC}s = {total_duration:.0f}s total")
    
    # Step 4: Execute
    timeline_name = f"Barnstorm_Slideshow_{venue_name.replace(' ', '_')}"
    
    if use_ffmpeg_fallback:
        # Direct FFmpeg render (no Resolve needed)
        output_path = os.path.join(photo_path, f"_slideshow_{venue_name.replace(' ', '_')}.mp4")
        print(f"\n[4/4] Rendering slideshow via FFmpeg...")
        success = create_ffmpeg_slideshow(selected, output_path, venue_name)
    else:
        # Send to DaVinci Resolve Bridge
        print(f"\n[4/4] Sending to DaVinci Resolve Bridge...")
        print(f"  Timeline: {timeline_name}")
        
        if not check_bridge_health():
            print("  [WARN] Bridge not available. Falling back to FFmpeg render.")
            output_path = os.path.join(photo_path, f"_slideshow_{venue_name.replace(' ', '_')}.mp4")
            success = create_ffmpeg_slideshow(selected, output_path, venue_name)
        else:
            bridge_clips = [
                {
                    "filePath": entry["filePath"],
                    "startFrame": entry["startFrame"],
                    "endFrame": entry["endFrame"]
                }
                for entry in edl
            ]
            
            result = send_to_bridge("/assemble-timeline", {
                "timelineName": timeline_name,
                "clips": bridge_clips,
                "lutPath": BRAND_ASSETS["lut_file"],
                "watermarkPath": BRAND_ASSETS["logo_transparent"]
            })
            
            success = result.get("success", False)
            if success:
                print(f"  [OK] Timeline assembled: {result.get('timelineName')}")
                print(f"  [OK] Slides appended: {result.get('appendedCount')}")
            else:
                print(f"  [ERROR] Bridge returned: {result}")
    
    # Save EDL
    edl_output = os.path.join(photo_path, f"_slideshow_edl_{venue_name.replace(' ', '_')}.json")
    try:
        with open(edl_output, "w") as f:
            json.dump({
                "venue": venue_name,
                "timeline": timeline_name,
                "slides": edl,
                "totalDuration": total_duration,
                "brandAssets": BRAND_ASSETS
            }, f, indent=2)
        print(f"\n  EDL saved: {edl_output}")
    except Exception as e:
        print(f"\n  [WARN] Could not save EDL: {e}")
    
    print(f"\n{'='*60}")
    print(f"  SLIDESHOW COMPLETE")
    print(f"  Total slides: {len(selected)}")
    print(f"  Duration: {total_duration:.0f}s")
    print(f"  Apply LUT: {os.path.basename(BRAND_ASSETS['lut_file'])}")
    print(f"  Overlay Logo: {os.path.basename(BRAND_ASSETS['logo_transparent'])}")
    print(f"{'='*60}\n")


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Barnstorm Photo Slideshow Generator")
    parser.add_argument("--venue", type=str, help="Venue name")
    parser.add_argument("--year", type=int, default=2026, help="Year (default: 2026)")
    parser.add_argument("--photo-path", type=str, help="Direct path to photo folder")
    parser.add_argument("--max-slides", type=int, default=20, help="Max number of slides")
    parser.add_argument("--slide-duration", type=float, default=4.0, help="Seconds per slide")
    parser.add_argument("--ffmpeg", action="store_true", help="Use FFmpeg render instead of Resolve")
    
    args = parser.parse_args()
    
    global MAX_SLIDES, SLIDE_DURATION_SEC
    MAX_SLIDES = args.max_slides
    SLIDE_DURATION_SEC = args.slide_duration
    
    if args.photo_path:
        photo_path = args.photo_path
        venue_name = os.path.basename(photo_path)
    elif args.venue:
        # Try photos path first (2026), then raw backups (2025)
        photo_path = os.path.join(NAS_BASE, f"Photos\\{args.year}\\Barnstorm\\Weddings\\{args.venue}")
        if not os.path.exists(photo_path):
            photo_path = os.path.join(NAS_BASE, f"RAW Backups\\{args.year}\\Barnstorm {args.year}\\Weddings\\{args.venue}")
        venue_name = args.venue
    else:
        parser.error("Either --venue or --photo-path is required")
        return
    
    if not os.path.exists(photo_path):
        print(f"[ERROR] Path not found: {photo_path}")
        sys.exit(1)
    
    run_pipeline(photo_path, venue_name, use_ffmpeg_fallback=args.ffmpeg)


if __name__ == "__main__":
    main()
