#!/usr/bin/env python3
"""
rebuild-ideation-index.py — Sharded Ideation Registry Builder

Replaces the monolithic ideations.canonical.json with a sharded architecture:
  runtime/registry/ideations/
  ├── _index.json        ← Stats, counters, seenGuids, shard manifest
  ├── 2026-05.json       ← Monthly shard with lightweight index entries
  ├── 2026-06.json
  └── archived.json      ← ARCHIVED/DISCARDED entries (all months)

Source of truth: individual files in runtime/ideation-queue/IE-IDX-*.json
This script is the PROJECTION BUILDER — the index is always rebuildable.

Usage:
  python3 rebuild-ideation-index.py                    # Full rebuild
  python3 rebuild-ideation-index.py --dedup             # Also quarantine duplicate files
  python3 rebuild-ideation-index.py --dry-run           # Preview without writing
  python3 rebuild-ideation-index.py --validate          # Validate output against schemas

Runs on NAS: /app/creative-liberation-engine/
"""

from __future__ import annotations
import os
import sys
import json
import glob
import shutil
import hashlib
import argparse
from datetime import datetime, timezone
from collections import defaultdict

# ─── Configuration ───────────────────────────────────────────────────────────

BASE_DIR = "/app/creative-liberation-engine"
QUEUE_DIR = os.path.join(BASE_DIR, "runtime/ideation-queue")
SHARD_DIR = os.path.join(BASE_DIR, "runtime/registry/ideations")
DUPES_DIR = os.path.join(QUEUE_DIR, "duplicates")
OLD_MONOLITH = os.path.join(BASE_DIR, "runtime/registry/ideations.canonical.json")
SCHEMA_DIR = os.path.join(BASE_DIR, "schemas")

# Lifecycle statuses considered "archived" (shunted to archived.json)
ARCHIVED_STATUSES = {"ARCHIVED", "DISCARDED"}

# ─── Helix Classification ───────────────────────────────────────────────────

HELIX_KEYWORDS = {
    "INFRASTRUCTURE": ["energy", "orchestration", "parallel", "credit", "subquadratic",
                        "mcp", "docker", "deploy", "server", "api", "backend", "devops",
                        "kubernetes", "cloud", "pipeline", "microservice", "database"],
    "COGNITIVE_CORE": ["graph", "data", "web layer", "control plane", "memory", "rag",
                       "retrieval", "embedding", "knowledge", "semantic", "ontology",
                       "reasoning", "context", "llm", "model", "training", "fine-tun"],
    "CREATIVE_DIRECTOR": ["design", "3d", "visual", "dashboard", "cad", "ui", "ux",
                           "animation", "typography", "figma", "framer", "aesthetic",
                           "gaussian", "splat", "voxel", "render"],
    "VIDEO_PIPELINE": ["video", "multimedia", "podcast", "stream", "resolve",
                       "davinci", "camera", "filming", "editing", "audio"],
    "EDGE_SECURITY": ["security", "pentest", "provenance", "hardware", "encrypt",
                      "quantum", "worm", "vulnerability", "zero-trust", "auth"],
    "PRODUCT_STRATEGY": ["startup", "funding", "raise", "business", "enterprise",
                         "market", "revenue", "saas", "pricing", "competitor",
                         "acquisition", "valuation"],
    "AGENT_MESH": ["agent", "swarm", "multi-agent", "autonomous", "coding agent",
                   "claude code", "openclaw", "opencode", "agentic", "dispatch",
                   "workflow", "orchestrat"],
}


def classify_helix(title: str, directive: str) -> str:
    """Classify ideation into a strategic helix based on content keywords."""
    content = (title + " " + directive).lower()
    scores = {}
    for helix, keywords in HELIX_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in content)
        if score > 0:
            scores[helix] = score
    if not scores:
        return "UNASSIGNED"
    return max(scores, key=scores.get)


def classify_domain(title: str, directive: str) -> str:
    """Map to schema-compliant domain enum."""
    helix = classify_helix(title, directive)
    domain_map = {
        "INFRASTRUCTURE": "infrastructure",
        "COGNITIVE_CORE": "research",
        "CREATIVE_DIRECTOR": "creative",
        "VIDEO_PIPELINE": "creative",
        "EDGE_SECURITY": "security",
        "PRODUCT_STRATEGY": "business",
        "AGENT_MESH": "infrastructure",
        "UNASSIGNED": "operations",
    }
    return domain_map.get(helix, "operations")


# ─── Core Parser ─────────────────────────────────────────────────────────────

def parse_ideation_file(filepath: str) -> dict | None:
    """Parse an individual ideation queue JSON file into a lightweight index entry."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        print(f"  ⚠ Skipping corrupt file: {os.path.basename(filepath)} ({e})")
        return None

    # Extract ID
    job_id = data.get("jobId", data.get("id", ""))
    if not job_id:
        basename = os.path.basename(filepath).replace(".json", "")
        job_id = basename

    # Normalize ID to pattern IE-IDX-NNNN
    if not job_id.startswith("IE-IDX-"):
        job_id = f"IE-IDX-{job_id}"

    # Extract slug
    slug = data.get("slug", os.path.basename(filepath).replace(".json", "").split("_", 1)[-1] if "_" in os.path.basename(filepath) else "")

    # Extract status (lifecycle takes precedence)
    status = "INGESTED"
    if "lifecycle" in data:
        lc = data["lifecycle"]
        if isinstance(lc, dict):
            if "status" in lc:
                status = lc["status"]
            elif "transitions" in lc and lc["transitions"]:
                status = lc["transitions"][-1].get("to", status)
    if status == "INGESTED" and "status" in data:
        status = data["status"]

    # Extract source metadata
    source_article = data.get("sourceArticle", {})
    title = source_article.get("title", data.get("title", ""))
    source_url = source_article.get("url", "")
    source_guid = source_article.get("guid", "")
    source_author = source_article.get("author", "")
    source_type = data.get("sourceType", "unknown")
    if source_type == "unknown":
        source_raw = data.get("source", "unknown")
        if isinstance(source_raw, str):
            source_type = source_raw
        elif isinstance(source_raw, dict):
            source_type = source_raw.get("type", "unknown")

    # Extract ATHENA analysis
    athena = data.get("athenaOutput", {})
    directive = athena.get("directive", "") if athena else ""
    directive_preview = directive[:200] if directive else None

    # Classification
    categories = data.get("categories", [])
    relevance = data.get("cleRelevance", 0)
    helix = classify_helix(title, directive)
    domain = classify_domain(title, directive)

    # Timestamps
    created_at = data.get("createdAt", "")
    ideated_at = data.get("ideatedAt", "")

    # Relative file path
    rel_path = filepath.replace(BASE_DIR + "/", "").replace(BASE_DIR + "\\", "")

    # Dedup key: prefer GUID, fall back to URL hash, fall back to title hash
    dedup_key = ""
    if source_guid:
        dedup_key = source_guid
    elif source_url:
        dedup_key = hashlib.sha256(source_url.encode()).hexdigest()[:16]
    elif title:
        dedup_key = hashlib.sha256(title.encode()).hexdigest()[:16]

    return {
        "id": job_id,
        "slug": slug,
        "status": status,
        "title": title,
        "directive": directive_preview,
        "sourceType": source_type,
        "sourceUrl": source_url,
        "categories": categories,
        "tags": [],
        "domain": domain,
        "helix": helix,
        "relevance": relevance,
        "urgency": None,
        "priority": None,
        "owner": None,
        "createdAt": created_at,
        "ideatedAt": ideated_at or None,
        "lastModifiedAt": created_at,
        "nextReviewDue": None,
        "crossRefCount": 0,
        "deliverableCount": 0,
        "filePath": rel_path,
        "_dedup_key": dedup_key,
        "_source_filepath": filepath,
    }


# ─── Deduplication Engine ────────────────────────────────────────────────────

def deduplicate(entries: list[dict], quarantine: bool = False, dry_run: bool = False) -> tuple[list[dict], list[dict]]:
    """
    Deduplicate ideation entries by source GUID/URL.
    Returns (unique_entries, duplicate_entries).
    If quarantine=True, moves duplicate files to the duplicates/ folder.
    """
    seen = {}
    unique = []
    duplicates = []

    # Sort by createdAt so we keep the earliest ingestion
    entries_sorted = sorted(entries, key=lambda e: e.get("createdAt", "") or "")

    for entry in entries_sorted:
        key = entry.get("_dedup_key", "")
        if not key:
            # No dedup key means we can't compare — keep it
            unique.append(entry)
            continue

        if key in seen:
            duplicates.append(entry)
            if quarantine and not dry_run:
                src = entry["_source_filepath"]
                dst = os.path.join(DUPES_DIR, os.path.basename(src))
                os.makedirs(DUPES_DIR, exist_ok=True)
                if os.path.exists(src):
                    shutil.move(src, dst)
                    print(f"  🗑 Quarantined: {os.path.basename(src)}")
        else:
            seen[key] = entry
            unique.append(entry)

    return unique, duplicates


# ─── Shard Builder ───────────────────────────────────────────────────────────

def extract_month(entry: dict) -> str:
    """Extract YYYY-MM from createdAt, or 'unknown' if missing."""
    created = entry.get("createdAt", "")
    if created and len(created) >= 7:
        return created[:7]
    return "unknown"


def build_shard(month: str, entries: list[dict], generated_at: str) -> dict:
    """Build a single monthly shard document."""
    # Strip internal dedup keys before writing
    clean_entries = []
    for e in entries:
        clean = {k: v for k, v in e.items() if not k.startswith("_")}
        clean_entries.append(clean)

    return {
        "version": "1.0.0",
        "month": month,
        "generatedAt": generated_at,
        "count": len(clean_entries),
        "ideations": clean_entries,
    }


def build_index(
    shards: dict[str, list[dict]],
    all_unique: list[dict],
    all_duplicates: list[dict],
    generated_at: str,
    last_job_number: int,
) -> dict:
    """Build the master _index.json."""
    # Stats
    status_counts = defaultdict(int)
    domain_counts = defaultdict(int)
    source_counts = defaultdict(int)
    helix_counts = defaultdict(int)
    total_relevance = 0
    relevance_count = 0

    for entry in all_unique:
        status_counts[entry.get("status", "UNKNOWN")] += 1
        domain_counts[entry.get("domain", "operations")] += 1
        source_counts[entry.get("sourceType", "unknown")] += 1
        helix_counts[entry.get("helix", "UNASSIGNED")] += 1
        rel = entry.get("relevance", 0)
        if rel and rel > 0:
            total_relevance += rel
            relevance_count += 1

    activated = sum(v for k, v in status_counts.items()
                    if k in {"ACTIVATED", "IN_PROGRESS", "SHIPPED", "VALIDATED", "COMPLETED"})
    completed = status_counts.get("COMPLETED", 0)
    total = len(all_unique)

    # Shard manifest
    shard_manifest = []
    for month in sorted(shards.keys()):
        entries = shards[month]
        filename = f"{month}.json" if month != "_archived" else "archived.json"
        shard_manifest.append({
            "month": month,
            "file": filename,
            "count": len(entries),
        })

    # Seen GUIDs for dedup on future ingestion
    seen_guids = []
    seen_urls = set()
    for entry in all_unique:
        dk = entry.get("_dedup_key", "")
        if dk:
            seen_guids.append(dk)
        url = entry.get("sourceUrl", "")
        if url:
            seen_urls.add(url)

    return {
        "version": "1.0.0",
        "generatedAt": generated_at,
        "lastJobNumber": last_job_number,
        "stats": {
            "total": total,
            "duplicatesQuarantined": len(all_duplicates),
            "uniqueEntries": total,
            "byStatus": dict(status_counts),
            "byDomain": dict(domain_counts),
            "bySource": dict(source_counts),
            "byHelix": dict(helix_counts),
            "avgRelevance": round(total_relevance / relevance_count, 1) if relevance_count else 0,
            "activationRate": round(activated / total * 100, 1) if total else 0,
            "completionRate": round(completed / activated * 100, 1) if activated else 0,
            "oldestUnreviewed": None,
            "nextReviewDue": None,
        },
        "shards": shard_manifest,
        "sources": {
            "seenGuids": seen_guids,
            "seenUrls": sorted(seen_urls),
            "lastPollAt": generated_at,
            "totalPolls": 0,
        },
        "reviewSchedule": {
            "nextMonthlyReview": None,
            "lastMonthlyReview": None,
            "overdueReviews": [],
            "upcomingReviews": [],
        },
    }


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Rebuild sharded ideation index from queue files")
    parser.add_argument("--dedup", action="store_true", help="Quarantine duplicate files to duplicates/ folder")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing files")
    parser.add_argument("--validate", action="store_true", help="Validate output against JSON schemas")
    args = parser.parse_args()

    generated_at = datetime.now(timezone.utc).isoformat()
    print(f"═══ Creative Liberation Engine — Ideation Index Rebuild ═══")
    print(f"    Timestamp: {generated_at}")
    print(f"    Queue dir: {QUEUE_DIR}")
    print(f"    Shard dir: {SHARD_DIR}")
    print(f"    Dedup:     {'ON — will quarantine' if args.dedup else 'OFF — index-only'}")
    print(f"    Dry run:   {'YES' if args.dry_run else 'NO'}")
    print()

    # 1. Scan queue files (only IE-IDX-*.json, skip brainstorm_* and ideation_* prefixes)
    pattern = os.path.join(QUEUE_DIR, "IE-IDX-*.json")
    files = sorted(glob.glob(pattern))
    print(f"  📂 Found {len(files)} IE-IDX-*.json files in queue")

    # 2. Parse all files
    entries = []
    max_job = 0
    for fp in files:
        entry = parse_ideation_file(fp)
        if entry:
            entries.append(entry)
            # Track highest job number
            try:
                job_num = int(entry["id"].replace("IE-IDX-", "").split("_")[0])
                max_job = max(max_job, job_num)
            except (ValueError, IndexError):
                pass

    print(f"  ✅ Parsed {len(entries)} valid entries (max job #{max_job})")

    # 3. Deduplicate
    unique, duplicates = deduplicate(entries, quarantine=args.dedup, dry_run=args.dry_run)
    print(f"  🔍 Unique: {len(unique)} | Duplicates: {len(duplicates)}")

    if duplicates:
        # Show sample duplicates
        shown = 0
        for d in duplicates[:5]:
            print(f"     ↳ DUP: {d['id']} — {d['title'][:60]}...")
            shown += 1
        if len(duplicates) > 5:
            print(f"     ↳ ... and {len(duplicates) - 5} more")

    # 4. Shard by month (archived entries go to a special shard)
    shards: dict[str, list[dict]] = defaultdict(list)
    for entry in unique:
        if entry.get("status") in ARCHIVED_STATUSES:
            shards["_archived"].append(entry)
        else:
            month = extract_month(entry)
            shards[month].append(entry)

    print(f"  📊 Shards: {len(shards)} months")
    for month in sorted(shards.keys()):
        print(f"     ↳ {month}: {len(shards[month])} entries")

    # 5. Build master index
    index = build_index(shards, unique, duplicates, generated_at, max_job)

    if args.dry_run:
        print()
        print("  🏁 DRY RUN — no files written")
        print(f"     Would write _index.json ({json.dumps(index['stats'], indent=2)})")
        for month in sorted(shards.keys()):
            filename = f"{month}.json" if month != "_archived" else "archived.json"
            print(f"     Would write {filename} ({len(shards[month])} entries)")
        return

    # 6. Write shard directory
    os.makedirs(SHARD_DIR, exist_ok=True)

    # Write _index.json
    index_path = os.path.join(SHARD_DIR, "_index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    print(f"  ✏️  Wrote: _index.json ({os.path.getsize(index_path)} bytes)")

    # Write monthly shards
    for month in sorted(shards.keys()):
        filename = f"{month}.json" if month != "_archived" else "archived.json"
        shard_path = os.path.join(SHARD_DIR, filename)
        shard_data = build_shard(month, shards[month], generated_at)
        with open(shard_path, "w", encoding="utf-8") as f:
            json.dump(shard_data, f, indent=2, ensure_ascii=False)
        print(f"  ✏️  Wrote: {filename} ({os.path.getsize(shard_path)} bytes)")

    # 7. Deprecate old monolith (rename, don't delete)
    if os.path.exists(OLD_MONOLITH):
        deprecated_name = OLD_MONOLITH.replace(".json", ".deprecated.json")
        if not os.path.exists(deprecated_name):
            shutil.move(OLD_MONOLITH, deprecated_name)
            print(f"  📦 Archived monolith: ideations.canonical.json → ideations.canonical.deprecated.json")
        else:
            print(f"  ⚠  Monolith already deprecated, skipping rename")

    # 8. Validate against schemas (optional)
    if args.validate:
        validate_output(index, shards, generated_at)

    print()
    print(f"  ═══ REBUILD COMPLETE ═══")
    print(f"  Total unique: {len(unique)}")
    print(f"  Duplicates:   {len(duplicates)} {'(quarantined)' if args.dedup else '(indexed only)'}")
    print(f"  Shards:       {len(shards)}")
    print(f"  Index size:   {os.path.getsize(index_path)} bytes")


def validate_output(index: dict, shards: dict, generated_at: str):
    """Basic structural validation (no jsonschema dependency needed)."""
    print()
    print("  🔬 Validation:")
    errors = 0

    # Check index structure
    required_keys = {"version", "generatedAt", "lastJobNumber", "stats", "shards", "sources"}
    missing = required_keys - set(index.keys())
    if missing:
        print(f"     ❌ _index.json missing keys: {missing}")
        errors += 1
    else:
        print(f"     ✅ _index.json structure valid")

    # Check stats
    stats = index.get("stats", {})
    if stats.get("total", 0) < 1:
        print(f"     ❌ stats.total is {stats.get('total')} — expected > 0")
        errors += 1
    else:
        print(f"     ✅ stats.total = {stats['total']}")

    # Check shard consistency
    shard_total = sum(len(entries) for entries in shards.values())
    if shard_total != stats.get("total", -1):
        print(f"     ⚠  Shard entry total ({shard_total}) ≠ stats.total ({stats.get('total')})")
    else:
        print(f"     ✅ Shard totals consistent")

    # Check for entries with empty IDs
    for month, entries in shards.items():
        for entry in entries:
            if not entry.get("id"):
                print(f"     ❌ Entry in {month} has empty ID")
                errors += 1
                break

    if errors == 0:
        print(f"     ✅ All validations passed")
    else:
        print(f"     ❌ {errors} validation error(s)")


if __name__ == "__main__":
    main()
