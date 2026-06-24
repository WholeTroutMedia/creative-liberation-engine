#!/usr/bin/env python3
"""
Creative Liberation Engine — Venue Digital Twin Ingest Pipeline
=====================================================
Watches for new scan assets dropped into the Venues directory,
classifies them, generates manifests, and queues processing jobs.

Usage:
    python ingest.py --venues-root /path/to/Venues
    python ingest.py --venues-root /path/to/Venues --process-existing
"""

import argparse
import json
import hashlib
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
VENUES_ROOT_DEFAULT = "/app/vault/Creative Liberation Engine/Venues"
REGISTRY_DIR = "_registry"
REGISTRY_FILE = "venues.json"
PIPELINE_DIR = "_pipeline"
RAW_DIR = "_raw"
PROCESSED_DIR = "_processed"

SCAN_EXTENSIONS = {
    ".glb": "mesh_glb",
    ".gltf": "mesh_gltf",
    ".obj": "mesh_obj",
    ".mtl": "material",
    ".ply": "pointcloud",
    ".las": "pointcloud",
    ".laz": "pointcloud",
    ".e57": "pointcloud",
    ".usdz": "mesh_ar",
    ".usda": "mesh_ar",
    ".usdc": "mesh_ar",
    ".fbx": "mesh_fbx",
    ".stl": "mesh_stl",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff"}
AUDIO_EXTENSIONS = {".wav", ".flac", ".mp3", ".aac"}

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
logger = logging.getLogger("venue-ingest")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def file_hash(path: Path, algo: str = "sha256") -> str:
    """Compute file hash for dedup."""
    h = hashlib.new(algo)
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def classify_file(path: Path) -> Optional[str]:
    """Return asset type string or None if unrecognized."""
    ext = path.suffix.lower()
    if ext in SCAN_EXTENSIONS:
        return SCAN_EXTENSIONS[ext]
    if ext in IMAGE_EXTENSIONS:
        return "photo"
    if ext in AUDIO_EXTENSIONS:
        return "audio"
    if ext == ".json":
        return "metadata"
    return None


def human_size(size_bytes: int) -> str:
    """Format bytes as human-readable string."""
    for unit in ("B", "KB", "MB", "GB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


# ---------------------------------------------------------------------------
# Venue Discovery
# ---------------------------------------------------------------------------
def discover_venues(venues_root: Path) -> List[dict]:
    """
    Walk the Venues directory structure and discover venue folders.
    Expected structure: Venues/{Region}/{VenueName}/_raw/{RoomName}/files...
    """
    venues = []
    skip_dirs = {REGISTRY_DIR, PIPELINE_DIR}

    for venue_dir in sorted(venues_root.iterdir()):
        if not venue_dir.is_dir() or venue_dir.name.startswith("_"):
            continue
        if venue_dir.name.startswith("@") or venue_dir.name.startswith("."):
            continue
        if venue_dir.name in skip_dirs:
            continue

        venue = scan_venue(venue_dir)
        if venue:
            venues.append(venue)

    return venues


def scan_venue(venue_dir: Path) -> Optional[dict]:
    """
    Scan a venue directory for assets. Handles two structures:
    1. Flat: venue_dir contains scan files directly
    2. Structured: venue_dir/_raw/{room}/ contains scan files
    """
    venue_name = venue_dir.name
    venue_id = venue_name.lower().replace(" ", "-").replace("_", "-")

    logger.info(f"  Scanning venue: {venue_name}")

    raw_dir = venue_dir / RAW_DIR
    rooms = []
    all_files = []

    # Check for structured layout (_raw/ subdirectory)
    if raw_dir.is_dir():
        for room_dir in sorted(raw_dir.iterdir()):
            if room_dir.is_dir():
                room_files = list(room_dir.rglob("*"))
                room_files = [f for f in room_files if f.is_file()]
                room = classify_room(room_dir, room_files)
                if room:
                    rooms.append(room)
                    all_files.extend(room_files)

    # Also check for flat files directly in venue dir
    flat_files = [f for f in venue_dir.iterdir()
                  if f.is_file() and classify_file(f) is not None]
    if flat_files and not rooms:
        # Treat flat files as a single "main" room
        room = classify_room(venue_dir, flat_files, room_name="main")
        if room:
            rooms.append(room)
            all_files.extend(flat_files)

    if not rooms and not all_files:
        logger.info(f"    No scan assets found (empty venue)")
        # Still create a pending manifest for tracking
        return create_venue_entry(venue_id, venue_name, venue_dir, [], "pending")

    logger.info(f"    Found {len(rooms)} room(s), {len(all_files)} file(s)")
    return create_venue_entry(venue_id, venue_name, venue_dir, rooms, "pending")


def classify_room(room_dir: Path, files: List[Path],
                  room_name: Optional[str] = None) -> Optional[dict]:
    """Classify files in a room directory into asset types."""
    if not room_name:
        room_name = room_dir.name

    room_id = room_name.lower().replace(" ", "-").replace("_", "-")

    scan_files = {}
    photos = []
    audio = []

    for f in files:
        ftype = classify_file(f)
        if ftype is None:
            continue

        rel_path = str(f)
        size = f.stat().st_size

        if ftype == "photo":
            photos.append({"path": rel_path, "size": size})
        elif ftype == "audio":
            audio.append({"path": rel_path, "size": size, "format": f.suffix.lower()})
        elif ftype != "metadata":
            scan_files[ftype] = {
                "path": rel_path,
                "size": size,
                "size_human": human_size(size),
            }

    if not scan_files:
        return None

    total_size = sum(f.stat().st_size for f in files if f.is_file())

    room = {
        "room_id": room_id,
        "name": room_name.replace("-", " ").replace("_", " ").title(),
        "scan_files": scan_files,
        "photo_count": len(photos),
        "audio_count": len(audio),
        "file_count": len(files),
        "total_size": total_size,
        "total_size_human": human_size(total_size),
    }

    logger.info(
        f"      Room '{room['name']}': {len(scan_files)} scan type(s), "
        f"{len(photos)} photo(s), {human_size(total_size)}"
    )

    return room


def create_venue_entry(venue_id: str, name: str,
                       venue_dir: Path, rooms: List[dict],
                       status: str) -> dict:
    """Create a venue manifest entry."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "venue_id": venue_id,
        "name": name.replace("-", " ").replace("_", " ").title(),
        "path": str(venue_dir),
        "rooms": rooms,
        "room_count": len(rooms),
        "processing_status": status,
        "captured": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "created_at": now,
        "updated_at": now,
    }


# ---------------------------------------------------------------------------
# Manifest Generation
# ---------------------------------------------------------------------------
def write_venue_manifest(venue: dict, venue_dir: Path) -> Path:
    """Write a manifest.json into the venue directory."""
    manifest_path = venue_dir / "manifest.json"

    # Preserve existing manifest data if present
    if manifest_path.exists():
        try:
            existing = json.loads(manifest_path.read_text(encoding="utf-8"))
            # Preserve user-entered fields
            for key in ("address", "geo", "contact", "capacity", "notes"):
                if key in existing and key not in venue:
                    venue[key] = existing[key]
            # Preserve room-level user data
            existing_rooms = {r["room_id"]: r for r in existing.get("rooms", [])}
            for room in venue.get("rooms", []):
                if room["room_id"] in existing_rooms:
                    er = existing_rooms[room["room_id"]]
                    for key in ("dimensions", "capacity", "features", "notes"):
                        if key in er and key not in room:
                            room[key] = er[key]
        except (json.JSONDecodeError, KeyError):
            pass

    venue["updated_at"] = datetime.now(timezone.utc).isoformat()

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(venue, f, indent=2, ensure_ascii=False)

    logger.info(f"  Wrote manifest: {manifest_path}")
    return manifest_path


def update_registry(venues: List[dict], venues_root: Path) -> Path:
    """Update the master venues.json registry."""
    registry_dir = venues_root / REGISTRY_DIR
    registry_dir.mkdir(parents=True, exist_ok=True)
    registry_path = registry_dir / REGISTRY_FILE

    # Build registry entries (slim — no room details)
    registry_entries = []
    total_rooms = 0
    for v in venues:
        total_rooms += v.get("room_count", 0)
        entry = {
            "venue_id": v["venue_id"],
            "name": v["name"],
            "path": v["path"],
            "room_count": v.get("room_count", 0),
            "status": v.get("processing_status", "pending"),
            "captured": v.get("captured"),
            "manifest_path": str(Path(v["path"]) / "manifest.json"),
        }
        if "geo" in v:
            entry["geo"] = v["geo"]
        registry_entries.append(entry)

    registry = {
        "version": "1.0.0",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total_venues": len(venues),
        "total_rooms": total_rooms,
        "venues": registry_entries,
    }

    with open(registry_path, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)

    logger.info(f"Registry updated: {len(venues)} venue(s), {total_rooms} room(s)")
    return registry_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run_ingest(venues_root: Path, process_existing: bool = False) -> dict:
    """Run the full ingest pipeline."""
    logger.info(f"=== Venue Digital Twin Ingest ===")
    logger.info(f"Root: {venues_root}")

    if not venues_root.is_dir():
        logger.error(f"Venues root not found: {venues_root}")
        sys.exit(1)

    # Discover all venues
    venues = discover_venues(venues_root)

    if not venues:
        logger.info("No venues found.")
        return {"venues": 0, "rooms": 0}

    # Write individual manifests
    for venue in venues:
        venue_dir = Path(venue["path"])
        write_venue_manifest(venue, venue_dir)

    # Update master registry
    registry_path = update_registry(venues, venues_root)

    summary = {
        "venues": len(venues),
        "rooms": sum(v.get("room_count", 0) for v in venues),
        "registry": str(registry_path),
    }

    logger.info(f"=== Ingest Complete ===")
    logger.info(f"  Venues: {summary['venues']}")
    logger.info(f"  Rooms:  {summary['rooms']}")
    logger.info(f"  Registry: {summary['registry']}")

    return summary


def main():
    parser = argparse.ArgumentParser(
        description="Creative Liberation Engine Venue Digital Twin Ingest Pipeline"
    )
    parser.add_argument(
        "--venues-root",
        type=str,
        default=VENUES_ROOT_DEFAULT,
        help=f"Path to Venues root directory (default: {VENUES_ROOT_DEFAULT})",
    )
    parser.add_argument(
        "--process-existing",
        action="store_true",
        help="Re-process existing venues even if manifests exist",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable debug logging",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    venues_root = Path(args.venues_root)
    run_ingest(venues_root, args.process_existing)


if __name__ == "__main__":
    main()
