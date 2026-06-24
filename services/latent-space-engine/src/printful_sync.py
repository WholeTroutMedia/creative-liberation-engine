import os
import json
import requests
import time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class PrintfulSync:
    def __init__(self, memory_service_url: str = None):
        self.api_key = os.getenv("PRINTFUL_API_KEY")
        self.base_url = "https://api.printful.com"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-PF-Store-Id": "16938987"  # Explicit Jaharoni Webstore binding using standard Printful header
        }
        self.memory_service_url = memory_service_url or os.getenv("MEMORY_SERVICE_URL", "http://localhost:5070")

    def get_latest_drop_from_memory(self) -> dict:
        url = f"{self.memory_service_url}/api/documents/latent_space_current_drop/active"
        try:
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                data = res.json()
                latest = data.get("activeState", {}).get("latest")
                if latest:
                    return latest
        except Exception as e:
            print(f"[WARNING] Failed to load latest drop from memory: {e}")
        return {}

    def create_print_draft(self, drop_data: dict, public_image_url: str) -> dict:
        """
        Drafts matching streetwear garment templates in your Printful store catalog.
        Implements an exponential backoff retry mechanism to reliably bypass Printful's burst rate limit (429).
        Polls for generated mockup preview URLs by querying product details in a robust loop.
        Returns a dictionary mapping apparel keys to official mockup URLs.
        """
        if not self.api_key:
            print("[PRINTFUL] Dry Run (API Key not configured). Simulating print draft setup.")
            return {
                "tee_mockup": "https://images.printful.com/mockups/dry_run_tshirt.png",
                "hoodie_mockup": "https://images.printful.com/mockups/dry_run_hoodie.png"
            }

        print(f"[PRINTFUL] Drafting templates for {drop_data['title']} using Shopify CDN: {public_image_url}")

        url = f"{self.base_url}/store/products"
        payload = {
            "sync_product": {
                "name": f"Latent Space: {drop_data['title']}",
                "thumbnail": public_image_url
            },
            "sync_variants": [
                {
                    "retail_price": "38.00",
                    "variant_id": 4019,  # Bella + Canvas 3001 Unisex Tee - Black / XL
                    "files": [
                        {
                            "url": public_image_url,
                            "filename": drop_data["filename"]
                        }
                    ]
                },
                {
                    "retail_price": "75.00",
                    "variant_id": 5532,  # Gildan 18500 Unisex Heavy Blend Hoodie - Black / L
                    "files": [
                        {
                            "url": public_image_url,
                            "filename": drop_data["filename"]
                        }
                    ]
                }
            ]
        }
        
        max_retries = 4
        backoff = 4
        
        for attempt in range(max_retries):
            try:
                response = requests.post(url, json=payload, headers=self.headers)
                
                # Check for rate-limiting status
                if response.status_code == 429:
                    print(f"[PRINTFUL WARNING] Hit 429 rate limit. Retrying in {backoff} seconds (Attempt {attempt+1}/{max_retries})...")
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                
                if response.status_code >= 400:
                    print(f"[PRINTFUL ERROR] Raw response: {response.text}")
                response.raise_for_status()
                res_data = response.json()
                print("[PRINTFUL SUCCESS] Product container drafted successfully.")
                
                product_id = res_data.get("result", {}).get("id")
                if not product_id:
                    print("[PRINTFUL ERROR] No product ID returned in response.")
                    return {
                        "tee_mockup": "https://images.printful.com/mockups/dry_run_tshirt.png",
                        "hoodie_mockup": "https://images.printful.com/mockups/dry_run_hoodie.png"
                    }
                
                # Robust Polling Loop: printful downloads new files asynchronously. We poll up to 18 times with a 5s sleep (90s max).
                tee_mockup = None
                hoodie_mockup = None
                
                print(f"[PRINTFUL] Polling Printful background mockup generator for Product {product_id}...")
                for poll in range(18):
                    time.sleep(5)
                    get_url = f"{self.base_url}/store/products/{product_id}"
                    get_res = requests.get(get_url, headers=self.headers)
                    get_res.raise_for_status()
                    get_data = get_res.json()
                    
                    result = get_data.get("result", {})
                    sync_variants = result.get("sync_variants", [])
                    
                    for sv in sync_variants:
                        v_id = sv.get("variant_id")
                        mockup_url = None
                        for file in sv.get("files", []):
                            if file.get("type") == "preview":
                                mockup_url = file.get("preview_url") or file.get("url")
                                break
                        
                        if mockup_url:
                            if v_id == 4019:
                                tee_mockup = mockup_url
                            elif v_id == 5532:
                                hoodie_mockup = mockup_url
                    
                    if tee_mockup and hoodie_mockup:
                        print(f"[PRINTFUL SUCCESS] Mockups resolved on poll {poll+1}: Tee: {tee_mockup[:45]}..., Hoodie: {hoodie_mockup[:45]}...")
                        break
                    else:
                        print(f"  [PRINTFUL POLL {poll+1}/18] Mockups still processing...")
                
                # Final check and fallback
                prod_thumbnail = result.get("sync_product", {}).get("thumbnail_url")
                if not tee_mockup:
                    print("[PRINTFUL WARNING] T-Shirt mockup generation timed out. Falling back to thumbnail.")
                    tee_mockup = prod_thumbnail
                if not hoodie_mockup:
                    print("[PRINTFUL WARNING] Hoodie mockup generation timed out. Falling back to thumbnail.")
                    hoodie_mockup = prod_thumbnail
                    
                return {
                    "tee_mockup": tee_mockup,
                    "hoodie_mockup": hoodie_mockup
                }
                
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"[PRINTFUL WARNING] Attempt {attempt+1} failed: {e}. Retrying in {backoff}s...")
                    time.sleep(backoff)
                    backoff *= 2
                else:
                    print(f"[PRINTFUL ERROR] Direct draft failed after {max_retries} attempts: {e}")
                    if 'response' in locals() and hasattr(response, 'text'):
                        print(f"[PRINTFUL ERROR DETAILS] Response: {response.text}")
                    return {
                        "tee_mockup": "https://images.printful.com/mockups/dry_run_tshirt.png",
                        "hoodie_mockup": "https://images.printful.com/mockups/dry_run_hoodie.png"
                    }

    def sync_latest(self) -> dict:
        drop = self.get_latest_drop_from_memory()
        if not drop:
            print("[PRINTFUL] No active drop in memory spine. Run curation first.")
            return {}
        
        public_image_url = drop.get("shopify_image_url")
        if not public_image_url:
            print("[PRINTFUL] No shopify cdn image url in drop data. Skipping sync.")
            return {}
            
        mockups = self.create_print_draft(drop, public_image_url)
        
        drop["printful_mockups"] = {
            "tee": mockups.get("tee_mockup"),
            "hoodie": mockups.get("hoodie_mockup")
        }
        
        # Save back to memory service
        url_history = f"{self.memory_service_url}/api/documents/latent_space_history/fields"
        requests.put(url_history, json={"key": drop["filename"], "value": drop}, timeout=5)
        
        url_current = f"{self.memory_service_url}/api/documents/latent_space_current_drop/fields"
        requests.put(url_current, json={"key": "latest", "value": drop}, timeout=5)
        
        return mockups

if __name__ == "__main__":
    sync = PrintfulSync()
    res = sync.sync_latest()
    print("[PRINTFUL SYNC RESULT]", json.dumps(res, indent=2))
