#!/usr/bin/env python3
"""
ideation-dedup-guard.py — Pre-ingestion dedup check for the Creative Liberation Engine.

Used by ingestion pipelines (Flipboard Sentinel, braindump, mobile-bridge, etc.)
BEFORE creating a new IE-IDX-*.json file. Checks the sharded index's seenGuids
and seenUrls sets to prevent duplicate ingestion at the source.

Usage:
  # Check if a URL has already been ingested
  python3 ideation-dedup-guard.py --url "https://example.com/article"

  # Check if a GUID has already been ingested
  python3 ideation-dedup-guard.py --guid "flipboard-UCTfGpD8SMO4gm1lhEKv1A:a:1234"

  # Get the next available job number
  python3 ideation-dedup-guard.py --next-id

Exit codes:
  0 = Not a duplicate (safe to ingest) / ID returned
  1 = Duplicate found (skip ingestion)
  2 = Error (index not found, etc.)
"""

from __future__ import annotations
import os
import sys
import json
import hashlib
import argparse

BASE_DIR = "/app/creative-liberation-engine"
INDEX_FILE = os.path.join(BASE_DIR, "runtime/registry/ideations/_index.json")


def load_index() -> dict | None:
    """Load the master index file."""
    if not os.path.exists(INDEX_FILE):
        print(f"ERROR: Index file not found: {INDEX_FILE}", file=sys.stderr)
        print(f"Run rebuild-ideation-index.py first.", file=sys.stderr)
        return None
    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def check_guid(guid: str, index: dict) -> bool:
    """Check if a GUID is already in the seen set. Returns True if duplicate."""
    seen = set(index.get("sources", {}).get("seenGuids", []))
    return guid in seen


def check_url(url: str, index: dict) -> bool:
    """Check if a URL is already ingested. Returns True if duplicate."""
    seen_urls = set(index.get("sources", {}).get("seenUrls", []))
    if url in seen_urls:
        return True
    # Also check URL hash against seenGuids (the rebuild script hashes URLs)
    url_hash = hashlib.sha256(url.encode()).hexdigest()[:16]
    seen_guids = set(index.get("sources", {}).get("seenGuids", []))
    return url_hash in seen_guids


def get_next_id(index: dict) -> int:
    """Return the next available job number."""
    return index.get("lastJobNumber", 0) + 1


def main():
    parser = argparse.ArgumentParser(description="Ideation dedup guard")
    parser.add_argument("--url", type=str, help="Check if URL is a duplicate")
    parser.add_argument("--guid", type=str, help="Check if GUID is a duplicate")
    parser.add_argument("--next-id", action="store_true", help="Print next available job number")
    args = parser.parse_args()

    if not any([args.url, args.guid, args.next_id]):
        parser.print_help()
        sys.exit(2)

    index = load_index()
    if index is None:
        sys.exit(2)

    if args.next_id:
        next_id = get_next_id(index)
        print(next_id)
        sys.exit(0)

    if args.guid:
        if check_guid(args.guid, index):
            print(f"DUPLICATE: GUID already ingested: {args.guid}")
            sys.exit(1)
        else:
            print(f"OK: GUID not found, safe to ingest")
            sys.exit(0)

    if args.url:
        if check_url(args.url, index):
            print(f"DUPLICATE: URL already ingested: {args.url}")
            sys.exit(1)
        else:
            print(f"OK: URL not found, safe to ingest")
            sys.exit(0)


if __name__ == "__main__":
    main()
