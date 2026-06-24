import json
import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
VENUES_ROOT_DEFAULT = r"\\127.0.0.1\The Vault\Creative Liberation Engine\Venues"
VENUES_ROOT = os.getenv("VENUES_ROOT", VENUES_ROOT_DEFAULT)
REGISTRY_FILE = os.path.join(VENUES_ROOT, "_registry", "venues.json")

QDRANT_URL = os.getenv("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_COLLECTION = "venues_twin"

# ---------------------------------------------------------------------------
# Logging & Setup
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("venue-api")

app = FastAPI(title="Venue Twin API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_qdrant():
    try:
        from qdrant_client import QdrantClient
        client = QdrantClient(url=QDRANT_URL)
        return client
    except Exception as e:
        logger.error(f"Failed to connect to Qdrant: {e}")
        return None

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class SearchQuery(BaseModel):
    query: str
    limit: int = 5
    venue_id: Optional[str] = None

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "venue-api"}

@app.get("/venues")
def list_venues():
    """Return the master venue registry."""
    if not os.path.exists(REGISTRY_FILE):
        raise HTTPException(status_code=404, detail="Registry not found")
    with open(REGISTRY_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/venues/{venue_id}")
def get_venue_manifest(venue_id: str):
    """Return the full manifest.json for a specific venue."""
    registry = list_venues()
    for venue in registry.get("venues", []):
        if venue["venue_id"] == venue_id:
            manifest_path = venue.get("manifest_path")
            if manifest_path and os.path.exists(manifest_path):
                with open(manifest_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            else:
                # Fallback path resolution
                venue_dir = os.path.join(VENUES_ROOT, venue["name"])
                manifest_fallback = os.path.join(venue_dir, "manifest.json")
                if os.path.exists(manifest_fallback):
                    with open(manifest_fallback, "r", encoding="utf-8") as f:
                        return json.load(f)
                
    raise HTTPException(status_code=404, detail=f"Venue '{venue_id}' not found or manifest missing")

@app.post("/venues/search")
def search_venues(query: SearchQuery):
    """Semantic search across venues and rooms via Qdrant."""
    qdrant = get_qdrant()
    if not qdrant:
        raise HTTPException(status_code=503, detail="Qdrant vector database is unavailable")
        
    try:
        # Import sentence transformers here to avoid blocking startup
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("all-MiniLM-L6-v2")
        
        vector = model.encode(query.query).tolist()
        
        # Build filter if venue_id provided
        search_filter = None
        if query.venue_id:
            from qdrant_client.http import models as qmodels
            search_filter = qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="venue_id",
                        match=qmodels.MatchValue(value=query.venue_id)
                    )
                ]
            )
            
        results = qdrant.search(
            collection_name=QDRANT_COLLECTION,
            query_vector=vector,
            query_filter=search_filter,
            limit=query.limit
        )
        
        return {
            "query": query.query,
            "hits": [
                {
                    "score": r.score,
                    "payload": r.payload
                } for r in results
            ]
        }
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/assets/{venue_id}/{room_id}/{filename:path}")
def serve_asset(venue_id: str, room_id: str, filename: str):
    """Serve raw assets (GLB, splats, photos) for 3D viewers."""
    # This assumes the flattened directory structure we verified earlier
    # Path: Venues/{Venue Name}/_raw/{room_id}/{filename}
    
    registry = list_venues()
    venue_path = None
    for venue in registry.get("venues", []):
        if venue["venue_id"] == venue_id:
            venue_path = venue.get("path")
            break
            
    if not venue_path:
        # Fallback to scanning dir
        for d in os.listdir(VENUES_ROOT):
            if d.lower().replace(" ", "-").replace("_", "-") == venue_id:
                venue_path = os.path.join(VENUES_ROOT, d)
                break
                
    if not venue_path:
        raise HTTPException(status_code=404, detail=f"Venue '{venue_id}' not found")
        
    # Check if the asset is in _raw
    # Note: filename might contain subpaths like 'mesh.glb' or 'splats/scene.ply'
    asset_path = os.path.join(venue_path, "_raw", room_id, filename)
    
    if not os.path.exists(asset_path):
        # Maybe it's flat?
        flat_asset_path = os.path.join(venue_path, filename)
        if os.path.exists(flat_asset_path):
            asset_path = flat_asset_path
        else:
            raise HTTPException(status_code=404, detail=f"Asset not found: {filename}")
            
    # Return file response with proper CORS headers handled by middleware
    return FileResponse(asset_path)

if __name__ == "__main__":
    import uvicorn
    # When run directly, start on port 8085
    uvicorn.run(app, host="0.0.0.0", port=8085)
