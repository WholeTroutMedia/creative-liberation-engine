#!/usr/bin/env python3
"""
Plex Dialogue Harvester — CLE Academy
=============================================
Tier 1 harvester (always running, low priority).
Extracts subtitles from Plex library, structures dialogue via
the Reasoning Structurizer, and stores vectors in Qdrant.

Phase 2 of the Cortex x Plex integration.
"""
from __future__ import annotations

import asyncio, json, os, re, time, logging
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger("PlexDialogue")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s — %(message)s'))
    logger.addHandler(ch)

# ─── Import sibling modules ─────────────────────────────────────────────────
try:
    from plex_client import PlexClient, PlexMediaItem
except ImportError:
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from plex_client import PlexClient, PlexMediaItem

try:
    from reasoning_structurizer import structurize_text_to_reasoning_chains, save_structured_data
    STRUCTURIZER_AVAILABLE = True
except ImportError:
    STRUCTURIZER_AVAILABLE = False
    logger.warning("reasoning_structurizer not available — raw text only")

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qmodels
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False

# ─── Configuration ───────────────────────────────────────────────────────────

ACADEMY_BASE = "/volume1/cle/academy"
DIALOGUE_PATH = f"{ACADEMY_BASE}/dialogue"
PROGRESS_FILE = f"{ACADEMY_BASE}/dialogue_progress.json"
QDRANT_HOST = "127.0.0.1"
QDRANT_PORT = 6333
COLLECTION_NAME = "cle_academy"

# Priority order for library processing
PRIORITY_ORDER = ["movie", "documentary", "show"]


# ─── Subtitle Cleaning (adapted from youtube_scraper.py) ─────────────────────

def clean_subtitle_text(raw: str) -> str:
    """Clean SRT/VTT/ASS subtitle text into plain dialogue."""
    # Remove ASS header/style blocks
    if "[Script Info]" in raw or "[V4+ Styles]" in raw:
        # ASS format — extract dialogue lines only
        lines = []
        for line in raw.split("\n"):
            if line.startswith("Dialogue:"):
                # Extract text after the last comma in the timing fields
                parts = line.split(",", 9)
                if len(parts) >= 10:
                    text = parts[9].strip()
                    # Remove ASS formatting tags
                    text = re.sub(r'\{[^}]*\}', '', text)
                    text = text.replace("\\N", " ").replace("\\n", " ")
                    if text.strip():
                        lines.append(text.strip())
        return "\n".join(lines)

    # SRT/VTT format
    cleaned = []
    for line in raw.split("\n"):
        line = line.strip()
        # Skip sequence numbers
        if re.match(r'^\d+$', line):
            continue
        # Skip timestamps
        if re.match(r'^\d{2}:\d{2}:\d{2}', line):
            continue
        if '-->' in line:
            continue
        # Skip VTT headers
        if line.startswith("WEBVTT") or line.startswith("NOTE"):
            continue
        # Remove HTML tags
        line = re.sub(r'<[^>]+>', '', line)
        # Remove speaker labels like "[Speaker]:" or "(narration)"
        line = re.sub(r'^\[[^\]]*\]:\s*', '', line)
        if line:
            cleaned.append(line)

    # Deduplicate consecutive identical lines (VTT repetition)
    deduped = []
    for line in cleaned:
        if not deduped or line != deduped[-1]:
            deduped.append(line)

    return "\n".join(deduped)


# ─── Progress Tracking ──────────────────────────────────────────────────────

def load_progress() -> dict:
    """Load harvest progress state — survives restarts."""
    if os.path.isfile(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"completed": [], "failed": [], "last_run": 0}


def save_progress(progress: dict):
    os.makedirs(os.path.dirname(PROGRESS_FILE), exist_ok=True)
    progress["last_run"] = int(time.time())
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2)


# ─── Qdrant Integration ─────────────────────────────────────────────────────

def ensure_collection(client: QdrantClient):
    """Create the cle_academy collection if it doesn't exist."""
    collections = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in collections:
        logger.info(f"[*] Creating Qdrant collection: {COLLECTION_NAME}")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config={
                "technique": qmodels.VectorParams(size=768, distance=qmodels.Distance.COSINE),
                "dialogue": qmodels.VectorParams(size=768, distance=qmodels.Distance.COSINE),
                "visual": qmodels.VectorParams(size=512, distance=qmodels.Distance.COSINE),
                "metadata": qmodels.VectorParams(size=768, distance=qmodels.Distance.COSINE),
            }
        )
        logger.info(f"[+] Collection created with 4 named vector fields")


def store_dialogue_vectors(qdrant: QdrantClient, item: PlexMediaItem,
                           dialogue_text: str, chains: list):
    """Store dialogue data as vectors in the cle_academy collection."""
    import uuid

    # Chunk the dialogue into segments (~500 chars each)
    chunks = [dialogue_text[i:i+500] for i in range(0, len(dialogue_text), 500)]

    points = []
    for i, chunk in enumerate(chunks):
        point_id = str(uuid.uuid4())
        payload = {
            "source": "plex",
            "type": "dialogue",
            "title": item.title,
            "year": item.year,
            "director": item.director,
            "genre": item.genre,
            "media_type": item.media_type,
            "rating_key": item.rating_key,
            "chunk_index": i,
            "content": chunk[:2000],
            "has_reasoning_chains": len(chains) > 0,
        }
        # Placeholder vector — will be replaced by real embeddings
        # when the embedding service is wired in
        points.append(qmodels.PointStruct(
            id=point_id,
            vector={"dialogue": [0.0] * 768},
            payload=payload,
        ))

    if points:
        qdrant.upsert(collection_name=COLLECTION_NAME, points=points)
        logger.info(f"  [+] Stored {len(points)} dialogue vectors for '{item.title}'")


# ─── Main Harvester ──────────────────────────────────────────────────────────

class PlexDialogueHarvester:
    """
    Tier 1 harvester — runs continuously at low priority.
    Extracts subtitles, cleans them, structures via LLM, stores to Qdrant.
    """

    def __init__(self, plex_token: Optional[str] = None):
        self.plex = PlexClient(token=plex_token)
        self.qdrant = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT) if QDRANT_AVAILABLE else None
        self.progress = load_progress()

        if self.qdrant:
            ensure_collection(self.qdrant)

    def harvest_library(self, priority_types: list = None):
        """
        Process the entire Plex library in priority order.
        Skips items that have already been processed (resumable).
        """
        priority_types = priority_types or PRIORITY_ORDER

        # Discover and connect
        self.plex.discover_servers()
        libraries = self.plex.get_libraries()

        # Sort libraries by priority
        sorted_libs = sorted(libraries,
            key=lambda l: priority_types.index(l["type"]) if l["type"] in priority_types else 99)

        for lib in sorted_libs:
            if lib["type"] not in ("movie", "show"):
                continue

            logger.info(f"\n{'='*60}")
            logger.info(f"Processing library: {lib['title']} ({lib['type']})")
            logger.info(f"{'='*60}")

            items = self.plex.get_all_library_items(lib["key"])
            for item in items:
                if item.rating_key in self.progress["completed"]:
                    continue  # Already processed
                if item.rating_key in self.progress["failed"]:
                    continue  # Skip persistent failures

                try:
                    self._process_item(item)
                    self.progress["completed"].append(item.rating_key)
                    save_progress(self.progress)
                except Exception as e:
                    logger.error(f"  [!] Failed: {item.title} — {e}")
                    self.progress["failed"].append(item.rating_key)
                    save_progress(self.progress)

                # Rate limit — be gentle with remote server
                time.sleep(1)

        logger.info(f"\n[+] Harvest complete. Processed: {len(self.progress['completed'])}, "
                    f"Failed: {len(self.progress['failed'])}")

    def _process_item(self, item: PlexMediaItem):
        """Process a single media item — extract and structure dialogue."""
        logger.info(f"\n[*] Processing: {item.title} ({item.year or '?'})")
        logger.info(f"    Director: {item.director or 'Unknown'} | Genre: {item.genre}")

        # 1. Get subtitle tracks
        subtitles = self.plex.get_subtitles(item.rating_key)
        if not subtitles:
            logger.info(f"  [!] No subtitles for '{item.title}' — skipping dialogue")
            return

        # 2. Pick best subtitle (prefer English, selected, SRT)
        best_sub = self._pick_best_subtitle(subtitles)
        if not best_sub or not best_sub.get("key"):
            logger.info(f"  [!] No downloadable subtitle for '{item.title}'")
            return

        # 3. Download subtitle
        sub_file = self.plex.download_subtitle(
            item.rating_key, best_sub["key"],
            out_dir=os.path.join(DIALOGUE_PATH, self._safe_dirname(item.title))
        )

        # 4. Clean subtitle text
        with open(sub_file, "r", encoding="utf-8", errors="replace") as f:
            raw_text = f.read()
        clean_text = clean_subtitle_text(raw_text)
        logger.info(f"  [+] Cleaned dialogue: {len(clean_text)} chars")

        if not clean_text.strip():
            logger.info(f"  [!] Empty dialogue after cleaning — skipping")
            return

        # 5. Save cleaned dialogue
        clean_path = sub_file.replace("_subtitle.", "_dialogue_clean.")
        clean_path = os.path.splitext(clean_path)[0] + ".txt"
        with open(clean_path, "w", encoding="utf-8") as f:
            f.write(clean_text)

        # 6. Structure via Reasoning Structurizer (Tier 1 — uses cloud fallback)
        chains = []
        if STRUCTURIZER_AVAILABLE:
            logger.info(f"  [*] Structurizing dialogue...")
            chains = structurize_text_to_reasoning_chains(clean_text)
            if chains:
                chains_path = os.path.splitext(clean_path)[0] + "_chains.json"
                save_structured_data(chains, chains_path)
                logger.info(f"  [+] {len(chains)} reasoning chains extracted")

        # 7. Store in Qdrant
        if self.qdrant:
            store_dialogue_vectors(self.qdrant, item, clean_text, chains)

        logger.info(f"  [✓] Complete: {item.title}")

    def _pick_best_subtitle(self, subs: list[dict]) -> Optional[dict]:
        """Pick the best subtitle track — English preferred, selected, SRT."""
        # Priority: selected English > any English > selected any > first available
        english = [s for s in subs if s.get("language","").lower() in ("english","eng")]
        selected = [s for s in subs if s.get("selected")]

        eng_selected = [s for s in english if s.get("selected")]
        if eng_selected: return eng_selected[0]
        if english: return english[0]
        if selected: return selected[0]
        return subs[0] if subs else None

    def _safe_dirname(self, title: str) -> str:
        """Sanitize title for filesystem use."""
        return re.sub(r'[<>:"/\\|?*]', '_', title)[:100]


# ─── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    harvester = PlexDialogueHarvester()

    if len(sys.argv) > 1 and sys.argv[1] == "single":
        # Process a single item by rating_key
        if len(sys.argv) < 3:
            print("Usage: plex_dialogue_harvester.py single <rating_key>")
            sys.exit(1)
        item = harvester.plex.get_item_metadata(sys.argv[2])
        harvester._process_item(item)
    else:
        # Full library harvest
        harvester.harvest_library()
