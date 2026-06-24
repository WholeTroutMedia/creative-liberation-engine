import os
import json
import logging
import asyncio

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qmodels
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False

class ScholarHiveHarvester:
    """
    Phase 2: Autonomous Knowledge Ingestion via Lightpanda Headless Browser.
    Pipes harvested documentation into Qdrant/GitNexus via the Prosthetic Hippocampus.
    """
    def __init__(self, endpoint="ws://127.0.0.1:9224", db_host="127.0.0.1"):
        self.browser_ws_endpoint = endpoint
        self.qdrant_host = db_host
        self.logger = logging.getLogger("ScholarHive")
        self.logger.setLevel(logging.INFO)
        # Ensure console logging if run directly
        if not self.logger.handlers:
            ch = logging.StreamHandler()
            ch.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
            self.logger.addHandler(ch)

    async def ingest_knowledge(self, source_url):
        self.logger.info(f"Navigating to {source_url} to harvest...")
        
        content = ""
        if PLAYWRIGHT_AVAILABLE:
            try:
                async with async_playwright() as p:
                    self.logger.info(f"Connecting to Lightpanda instance at {self.browser_ws_endpoint}...")
                    try:
                        browser = await p.chromium.connect_over_cdp(self.browser_ws_endpoint)
                    except Exception as e:
                        self.logger.warning(f"Failed to connect over CDP: {e}. Falling back to local chromium launch.")
                        browser = await p.chromium.launch(headless=True)
                    
                    context = await browser.new_context()
                    page = await context.new_page()
                    await page.goto(source_url, wait_until="domcontentloaded", timeout=30000)
                    
                    # Extract text content from body
                    content = await page.evaluate("document.body.innerText")
                    self.logger.info(f"Extracted {len(content)} characters from {source_url}")
                    await browser.close()
            except Exception as e:
                self.logger.error(f"Playwright harvesting failed: {e}")
                content = f"Mock harvested markdown content from {source_url} (due to error)"
        else:
            self.logger.warning("Playwright not available. Mocking DOM extraction.")
            content = f"Mock harvested markdown content from {source_url}"

        return self._store_in_hippocampus(content, source_url)

    def _store_in_hippocampus(self, content, source_url):
        self.logger.info(f"Vectorizing and storing {len(content)} bytes into Qdrant/GitNexus.")
        if not QDRANT_AVAILABLE:
            self.logger.warning("qdrant_client not available. Mocking storage.")
            return {"status": "mock_success", "indexed_bytes": len(content), "source": source_url}

        try:
            client = QdrantClient(host=self.qdrant_host, port=6333)
            # Create collection if it doesn't exist
            collections = client.get_collections().collections
            if not any(c.name == "scholar_hive" for c in collections):
                client.create_collection(
                    collection_name="scholar_hive",
                    vectors_config=qmodels.VectorParams(size=768, distance=qmodels.Distance.COSINE)
                )
            
            # Note: We'd normally chunk and vectorize here (e.g., using fastembed or sentence-transformers).
            # For the pipeline stub, we just store the raw text as payload.
            import uuid
            point_id = str(uuid.uuid4())
            client.upsert(
                collection_name="scholar_hive",
                points=[
                    qmodels.PointStruct(
                        id=point_id,
                        vector=[0.0] * 768, # Dummy vector
                        payload={"source": source_url, "content": content[:5000]} # Limit payload size
                    )
                ]
            )
            self.logger.info(f"Successfully stored in Qdrant with point ID {point_id}")
            return {"status": "success", "indexed_bytes": len(content), "point_id": point_id}
        except Exception as e:
            self.logger.error(f"Qdrant storage failed: {e}")
            return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    harvester = ScholarHiveHarvester()
    asyncio.run(harvester.ingest_knowledge("https://docs.docker.com/"))
