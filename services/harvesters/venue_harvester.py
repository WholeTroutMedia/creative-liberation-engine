#!/usr/bin/env python3
"""
Creative Liberation Engine — Venue Digital Twin Harvester
===============================================
Ingests the Venues registry into the Qdrant vector database,
making physical spaces and their dimensions queryable by agents.
"""

import json
import logging
import uuid
from pathlib import Path
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance
from sentence_transformers import SentenceTransformer

import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("venue-harvester")

QDRANT_HOST = "127.0.0.1"
QDRANT_PORT = 6333
COLLECTION_NAME = "spatial_venues"
VENUES_REGISTRY = sys.argv[1] if len(sys.argv) > 1 else r"\\127.0.0.1\The Vault\Creative Liberation Engine\Venues\_registry\venues.json"


def init_qdrant() -> QdrantClient:
    logger.info(f"Connecting to Qdrant at {QDRANT_HOST}:{QDRANT_PORT}")
    client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    
    collections = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in collections:
        logger.info(f"Creating collection '{COLLECTION_NAME}'...")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )
    return client

def build_vector_payload(venue: dict, manifest: dict) -> list:
    """Flatten venue and room data into embeddable chunks."""
    chunks = []
    
    # 1. Main Venue Chunk
    venue_desc = f"Venue Name: {venue['name']}\nStatus: {venue['status']}\nCaptured: {venue['captured']}\n"
    if "geo" in venue:
        venue_desc += f"Location: {venue['geo']}\n"
    if "notes" in manifest:
        venue_desc += f"Notes: {manifest['notes']}\n"
        
    chunks.append({
        "text": venue_desc,
        "metadata": {
            "venue_id": venue["venue_id"],
            "type": "venue_summary",
            "path": venue["path"]
        }
    })
    
    # 2. Room Chunks
    for room in manifest.get("rooms", []):
        room_desc = f"Room: {room['name']} in Venue: {venue['name']}\n"
        if "dimensions" in room:
            dims = room["dimensions"]
            room_desc += f"Dimensions: {dims.get('length_m', 0)}m x {dims.get('width_m', 0)}m x {dims.get('height_m', 0)}m\n"
            room_desc += f"Area: {dims.get('area_sqm', 0)} sqm\n"
        
        chunks.append({
            "text": room_desc,
            "metadata": {
                "venue_id": venue["venue_id"],
                "room_id": room["room_id"],
                "type": "room_details"
            }
        })
        
    return chunks

def run_harvest():
    registry_path = Path(VENUES_REGISTRY)
    if not registry_path.exists():
        logger.error(f"Registry not found: {registry_path}")
        return

    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    venues = registry.get("venues", [])
    
    if not venues:
        logger.info("No venues to harvest.")
        return

    logger.info("Loading embedding model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    client = init_qdrant()
    
    points = []
    
    for venue in venues:
        manifest_path = Path(venue["manifest_path"])
        if not manifest_path.exists():
            continue
            
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        chunks = build_vector_payload(venue, manifest)
        
        for chunk in chunks:
            vector = model.encode(chunk["text"]).tolist()
            point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"venue_{venue['venue_id']}_{chunk['metadata'].get('room_id', 'main')}"))
            
            points.append(PointStruct(
                id=point_id,
                vector=vector,
                payload={"text": chunk["text"], **chunk["metadata"]}
            ))
            
    if points:
        client.upsert(collection_name=COLLECTION_NAME, points=points)
        logger.info(f"Upserted {len(points)} spatial chunks into Qdrant collection '{COLLECTION_NAME}'.")

if __name__ == "__main__":
    run_harvest()
