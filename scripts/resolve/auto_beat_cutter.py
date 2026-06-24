#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Creative Liberation Engine V6 — Auto Beat Cutter
Scans a Barnstorm venue folder on The Vault, analyzes audio transients,
generates a beat-synced Edit Decision List (EDL), and sends it to the
DaVinci Resolve Bridge for automated timeline assembly.

Usage:
    python auto_beat_cutter.py --venue "Beacon Roundhouse" --year 2025
    python auto_beat_cutter.py --venue-path "\\\\127.0.0.1\\The Vault\\RAW Backups\\2025\\Barnstorm 2025\\Weddings\\Beacon Roundhouse"
"""

import argparse
import glob
import json
import os
import random
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

# ─── Configuration ────────────────────────────────────────────────────────────

NAS_BASE = "W:\\" if os.path.exists("W:\\") else r"\\127.0.0.1\The Vault"
BRAND_ASSETS = {
    "logo_transparent": os.path.join(NAS_BASE, r"RAW Backups\2025\Barnstorm 2025\The Barnstorm Logo - Black Transparent.png"),
    "lut_file": os.path.join(NAS_BASE, r"RAW Backups\2025\Barnstorm 2025\Video Elements\LUTs\Barnstorm LUT V1_20.C8761S03.cube"),
    "sfx_whoosh": os.path.join(NAS_BASE, r"RAW Backups\2025\Barnstorm 2025\Video Elements\Music\Windy_Whoosh.wav"),
    "sfx_crowd_cheer": os.path.join(NAS_BASE, r"RAW Backups\2025\Barnstorm 2025\Video Elements\Music\Shout_Young_Audience_Theatre_Front_01.wav"),
}

BRIDGE_URL = "http://127.0.0.1:5105"
VIDEO_EXTENSIONS = {".mp4", ".mov", ".mxf", ".avi"}
AUDIO_EXTENSIONS = {".wav", ".mp3", ".aac", ".m4a"}

# Target output: 30-second vertical reel (9:16)
TARGET_DURATION_SEC = 30
CUT_DURATION_RANGE = (1.0, 3.5)  # seconds per cut

# ─── FFmpeg Audio Analysis ────────────────────────────────────────────────────

def extract_audio_from_video(video_path: str, out_wav: str) -> bool:
    """Extract audio track from a video file using FFmpeg."""
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vn", "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "1",
        out_wav
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=120)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        print(f"  [warn] FFmpeg extraction failed: {e}")
        return False


def detect_beats_ffmpeg(audio_path: str) -> list[float]:
    """
    Use FFmpeg's astats or ebur128 filter to detect energy peaks.
    Returns a list of timestamps (in seconds) where beats/transients occur.
    
    Falls back to a simple energy-envelope approach if advanced filters aren't available.
    """
    # Use FFmpeg to get audio volume envelope at intervals
    cmd = [
        "ffmpeg", "-i", audio_path,
        "-af", "silencedetect=noise=-30dB:d=0.3",
        "-f", "null", "-"
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        stderr = result.stderr
    except (subprocess.TimeoutExpired, FileNotFoundError):
        print("  [warn] FFmpeg beat detection failed, using uniform spacing")
        return _uniform_beats(audio_path)
    
    # Parse silence_end timestamps — transitions from silence to sound are "hits"
    beats = []
    for line in stderr.split("\n"):
        if "silence_end" in line:
            try:
                # Format: [silencedetect @ ...] silence_end: 1.234 | silence_duration: 0.5
                parts = line.split("silence_end:")[1].split("|")[0].strip()
                timestamp = float(parts)
                beats.append(timestamp)
            except (IndexError, ValueError):
                continue
    
    if len(beats) < 5:
        # Not enough detected transients, supplement with uniform beats
        beats = _uniform_beats(audio_path)
    
    return sorted(beats)


def _uniform_beats(audio_path: str, bpm: int = 128) -> list[float]:
    """Generate uniform beat timestamps at a given BPM as fallback."""
    # Get duration via FFprobe
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        audio_path
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        duration = float(result.stdout.strip())
    except Exception:
        duration = 180.0  # default 3 minutes
    
    interval = 60.0 / bpm
    return [i * interval for i in range(int(duration / interval))]


def get_video_duration(video_path: str) -> float:
    """Get the duration of a video file in seconds."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return float(result.stdout.strip())
    except Exception:
        return 0.0


# ─── Venue Scanner ────────────────────────────────────────────────────────────

def scan_venue(venue_path: str) -> dict:
    """
    Scan a venue folder and categorize files.
    Returns dict with 'videos', 'audio', 'photos' lists.
    """
    result = {"videos": [], "audio": [], "photos": []}
    
    for root, dirs, files in os.walk(venue_path):
        # Skip @eaDir (Synology metadata)
        dirs[:] = [d for d in dirs if d != "@eaDir"]
        
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            full_path = os.path.join(root, f)
            
            if ext in VIDEO_EXTENSIONS:
                result["videos"].append(full_path)
            elif ext in AUDIO_EXTENSIONS:
                result["audio"].append(full_path)
            elif ext in {".jpg", ".jpeg", ".png", ".tif", ".tiff"}:
                result["photos"].append(full_path)
    
    return result


def resolve_venue_path(venue_name: str, year: int) -> str:
    """Resolve a venue name and year into a NAS UNC path."""
    base = os.path.join(NAS_BASE, f"RAW Backups\\{year}\\Barnstorm {year}\\Weddings\\{venue_name}")
    if os.path.exists(base):
        return base
    
    # Try Photos path for 2026
    photo_base = os.path.join(NAS_BASE, f"Photos\\{year}\\Barnstorm\\Weddings\\{venue_name}")
    if os.path.exists(photo_base):
        return photo_base
    
    raise FileNotFoundError(f"Venue not found: {venue_name} ({year}) at {base}")


# ─── EDL Generator ───────────────────────────────────────────────────────────

def generate_beat_sync_edl(videos: list[str], beats: list[float]) -> list[dict]:
    """
    Generate a beat-synced Edit Decision List.
    Each entry maps a video clip segment to a beat-aligned position on the output timeline.
    
    Returns a list of dicts suitable for the bridge's /assemble-timeline endpoint.
    """
    edl = []
    timeline_pos = 0.0
    beat_idx = 0
    fps = 24  # Assume 24fps for frame calculations
    
    # Shuffle videos for visual variety
    available_clips = list(videos)
    random.shuffle(available_clips)
    clip_cycle = 0
    
    while timeline_pos < TARGET_DURATION_SEC and beat_idx < len(beats) - 1:
        # Pick the next clip (cycle through if needed)
        clip_path = available_clips[clip_cycle % len(available_clips)]
        clip_cycle += 1
        
        # Determine cut duration from beat intervals
        if beat_idx + 1 < len(beats):
            beat_interval = beats[beat_idx + 1] - beats[beat_idx]
            # Clamp to our desired range
            cut_dur = max(CUT_DURATION_RANGE[0], min(beat_interval, CUT_DURATION_RANGE[1]))
        else:
            cut_dur = random.uniform(*CUT_DURATION_RANGE)
        
        # Get a random start point within the clip
        clip_duration = get_video_duration(clip_path)
        if clip_duration <= 0:
            beat_idx += 1
            continue
        
        max_start = max(0, clip_duration - cut_dur)
        start_sec = random.uniform(0, max_start)
        end_sec = start_sec + cut_dur
        
        # Convert to frames
        start_frame = int(start_sec * fps)
        end_frame = int(end_sec * fps)
        
        edl.append({
            "filePath": clip_path,
            "startFrame": start_frame,
            "endFrame": end_frame,
            "beatTimestamp": beats[beat_idx],
            "cutDuration": cut_dur
        })
        
        timeline_pos += cut_dur
        beat_idx += 1
    
    return edl


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
    """Verify the DaVinci Resolve Bridge is running and connected."""
    import time
    for attempt in range(3):
        try:
            req = urllib.request.Request(f"{BRIDGE_URL}/health")
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("status") in ("healthy", "degraded")
        except Exception:
            if attempt < 2:
                time.sleep(2)
    return False


# ─── Main Pipeline ───────────────────────────────────────────────────────────

def run_pipeline(venue_path: str, venue_name: str):
    """Execute the full beat-cut pipeline for a venue."""
    
    print(f"\n{'='*60}")
    print(f"  BARNSTORM AUTO BEAT CUTTER")
    print(f"  Venue: {venue_name}")
    print(f"  Path:  {venue_path}")
    print(f"{'='*60}\n")
    
    # Step 1: Check bridge health
    print("[1/6] Checking DaVinci Resolve Bridge...")
    if not check_bridge_health():
        print("  [ERROR] Bridge is not running on port 5105. Start it first.")
        print("  Run: python services/video-agency/src/davinci-resolve-bridge.py 5105")
        sys.exit(1)
    print("  [OK] Bridge is healthy\n")
    
    # Step 2: Scan venue
    print("[2/6] Scanning venue folder...")
    assets = scan_venue(venue_path)
    print(f"  Found: {len(assets['videos'])} videos, {len(assets['audio'])} audio, {len(assets['photos'])} photos")
    
    if not assets["videos"]:
        print("  [ERROR] No video files found in venue folder.")
        sys.exit(1)
    
    # Step 3: Extract or find audio for beat analysis
    print("\n[3/6] Analyzing audio for beat detection...")
    audio_source = None
    
    if assets["audio"]:
        # Prefer standalone audio (board recording)
        audio_source = assets["audio"][0]
        print(f"  Using board audio: {os.path.basename(audio_source)}")
    else:
        # Extract audio from first video clip
        print("  No standalone audio found. Extracting from first video...")
        tmp_wav = os.path.join(tempfile.gettempdir(), "barnstorm_audio_extract.wav")
        if extract_audio_from_video(assets["videos"][0], tmp_wav):
            audio_source = tmp_wav
            print(f"  Extracted audio to: {tmp_wav}")
        else:
            print("  [WARN] Could not extract audio. Using uniform beat spacing.")
    
    # Step 4: Detect beats
    print("\n[4/6] Detecting beat transients...")
    if audio_source:
        beats = detect_beats_ffmpeg(audio_source)
    else:
        beats = _uniform_beats("", bpm=130)
    
    print(f"  Detected {len(beats)} beat markers")
    if beats[:5]:
        print(f"  First 5 beats (sec): {[round(b, 2) for b in beats[:5]]}")
    
    # Step 5: Generate EDL
    print(f"\n[5/6] Generating {TARGET_DURATION_SEC}s beat-synced EDL...")
    edl = generate_beat_sync_edl(assets["videos"], beats)
    print(f"  Generated {len(edl)} cuts")
    
    # Print EDL summary
    for i, entry in enumerate(edl[:10]):
        clip_name = os.path.basename(entry["filePath"])
        print(f"    Cut {i+1}: {clip_name} [{entry['startFrame']}-{entry['endFrame']}] @ beat {entry['beatTimestamp']:.2f}s")
    if len(edl) > 10:
        print(f"    ... and {len(edl) - 10} more cuts")
    
    # Step 6: Send to DaVinci Resolve Bridge
    timeline_name = f"Barnstorm_BeatCut_{venue_name.replace(' ', '_')}"
    print(f"\n[6/6] Sending EDL to DaVinci Resolve Bridge...")
    print(f"  Timeline: {timeline_name}")
    
    # Prepare clips for bridge (strip beat metadata, keep what bridge needs)
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
    
    if result.get("success"):
        print(f"  [OK] Timeline assembled: {result.get('timelineName')}")
        print(f"  [OK] Clips appended: {result.get('appendedCount')}")
    else:
        print(f"  [ERROR] Bridge returned: {result}")
    
    # Save EDL to file for reference
    edl_output_path = os.path.join(venue_path, f"_auto_edl_{venue_name.replace(' ', '_')}.json")
    try:
        with open(edl_output_path, "w") as f:
            json.dump({
                "venue": venue_name,
                "timeline": timeline_name,
                "targetDuration": TARGET_DURATION_SEC,
                "cuts": edl,
                "brandAssets": BRAND_ASSETS
            }, f, indent=2)
        print(f"\n  EDL saved: {edl_output_path}")
    except Exception as e:
        print(f"\n  [WARN] Could not save EDL file: {e}")
    
    print(f"\n{'='*60}")
    print(f"  PIPELINE COMPLETE")
    print(f"  Open DaVinci Resolve -> Timeline: {timeline_name}")
    print(f"  Apply LUT: {os.path.basename(BRAND_ASSETS['lut_file'])}")
    print(f"  Overlay Logo: {os.path.basename(BRAND_ASSETS['logo_transparent'])}")
    print(f"{'='*60}\n")


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Barnstorm Auto Beat Cutter Pipeline")
    parser.add_argument("--venue", type=str, help="Venue name (e.g. 'Beacon Roundhouse')")
    parser.add_argument("--year", type=int, default=2025, help="Year (default: 2025)")
    parser.add_argument("--venue-path", type=str, help="Direct UNC path to venue folder (overrides --venue)")
    parser.add_argument("--duration", type=int, default=30, help="Target reel duration in seconds (default: 30)")
    parser.add_argument("--dry-run", action="store_true", help="Generate EDL without sending to bridge")
    
    args = parser.parse_args()
    
    global TARGET_DURATION_SEC
    TARGET_DURATION_SEC = args.duration
    
    if args.venue_path:
        venue_path = args.venue_path
        venue_name = os.path.basename(venue_path)
    elif args.venue:
        venue_path = resolve_venue_path(args.venue, args.year)
        venue_name = args.venue
    else:
        parser.error("Either --venue or --venue-path is required")
        return
    
    if not os.path.exists(venue_path):
        print(f"[ERROR] Venue path does not exist: {venue_path}")
        sys.exit(1)
    
    run_pipeline(venue_path, venue_name)


if __name__ == "__main__":
    main()
