import os
import json
import uvicorn
import threading
import time
import requests
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

from curator import MerchCurator, normalize_vault_path
from shopify_sync import ShopifySync
from printful_sync import PrintfulSync

app = FastAPI(
    title="Latent Space Engine",
    description="Autonomous Art Curation & Sync Service for CLE V6",
    version="6.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load configuration from environment
MERCH_SOURCE_DIR = os.getenv("MERCH_SOURCE_DIR", "Y:/creative-liberation-engine/archive/legacy-systems/services/latent-space-engine")
MEMORY_SERVICE_URL = os.getenv("MEMORY_SERVICE_URL", "http://localhost:5070")

curator = MerchCurator(source_dir=MERCH_SOURCE_DIR, memory_service_url=MEMORY_SERVICE_URL)
shopify = ShopifySync(memory_service_url=MEMORY_SERVICE_URL)
printful = PrintfulSync(memory_service_url=MEMORY_SERVICE_URL)

# Helper functions to load and save manifest config
def load_manifest() -> dict:
    config_dir = Path(__file__).parent.parent / "config"
    manifest_path = config_dir / "manifest.json"
    if manifest_path.exists():
        try:
            with open(manifest_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"[ERROR] Failed to read manifest.json: {e}")
    return {}

def save_manifest(manifest: dict):
    config_dir = Path(__file__).parent.parent / "config"
    manifest_path = config_dir / "manifest.json"
    try:
        config_dir.mkdir(parents=True, exist_ok=True)
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
    except Exception as e:
        print(f"[ERROR] Failed to write manifest.json: {e}")

# Scheduler Background Thread Class
class CurationScheduler(threading.Thread):
    def __init__(self, curator, shopify, printful, memory_service_url):
        super().__init__()
        self.curator = curator
        self.shopify = shopify
        self.printful = printful
        self.memory_service_url = memory_service_url
        self.daemon = True
        self.running = True

    def run(self):
        print("[SCHEDULER] Background curation scheduler thread started.")
        while self.running:
            try:
                self.check_and_trigger_curation()
            except Exception as e:
                print(f"[SCHEDULER ERROR] Exception in scheduler loop: {e}")
            # Poll every 60 seconds
            time.sleep(60)

    def check_and_trigger_curation(self):
        manifest = load_manifest()
        if not manifest:
            return

        sched_config = manifest.get("scheduler", {})
        if not sched_config.get("enabled", False):
            return

        interval_hours = sched_config.get("interval_hours", 72)
        current_profile_name = sched_config.get("current_profile")
        profiles = manifest.get("profiles", {})
        profile = profiles.get(current_profile_name)

        if not profile:
            print(f"[SCHEDULER WARNING] Active profile '{current_profile_name}' not found in manifest.")
            return

        # Determine last run timestamp
        last_run = sched_config.get("last_run_timestamp", 0)
        
        # Cross-reference with memory spine to see if there's a more recent drop
        memory_last_run = 0
        try:
            url = f"{self.memory_service_url}/api/documents/{self.curator.current_doc_id}/active"
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                latest = res.json().get("activeState", {}).get("latest", {})
                memory_last_run = latest.get("timestamp", 0)
        except Exception as e:
            print(f"[SCHEDULER WARNING] Failed to query memory spine for timestamp: {e}")

        effective_last_run = max(last_run, memory_last_run)
        now = time.time()

        # Check if first run initialization is needed
        if effective_last_run == 0:
            print("[SCHEDULER] First run detected. Initializing last run timestamp to now to prevent immediate trigger on reboot.")
            sched_config["last_run_timestamp"] = now
            save_manifest(manifest)
            return

        elapsed_seconds = now - effective_last_run
        interval_seconds = interval_hours * 3600

        if elapsed_seconds >= interval_seconds:
            print(f"[SCHEDULER] Interval of {interval_hours} hours elapsed. Triggering curation for profile '{current_profile_name}'...")
            self.execute_curation(profile, manifest)

    def execute_curation(self, profile: dict, manifest: dict):
        try:
            # 1. Curate next drop
            drop_data = self.curator.curate_next_drop(profile=profile)
            if not drop_data:
                print("[SCHEDULER ERROR] Curation failed to select an image.")
                return

            # Add timestamp
            now = time.time()
            drop_data["timestamp"] = now
            drop_data["formatted_date"] = datetime.now().isoformat()

            # 2. Archive expired drops on Shopify
            # self.shopify.delete_expired_drops()

            # 3. Create the product on Shopify
            local_path = drop_data.get("local_path")
            local_path = str(normalize_vault_path(local_path))
            
            shopify_res = self.shopify.create_merch_product(drop_data, local_image_path=local_path)

            drop_data["shopify_product_id"] = shopify_res.get("product_id")
            drop_data["shopify_variants"] = shopify_res.get("variants")
            drop_data["shopify_image_url"] = shopify_res.get("image_url")

            # 4. Sync to Printful automatically to generate mockups
            try:
                mockups = self.printful.create_print_draft(drop_data, shopify_res.get("image_url"))
                drop_data["printful_mockups"] = {
                    "tee": mockups.get("tee_mockup"),
                    "hoodie": mockups.get("hoodie_mockup")
                }
            except Exception as pf_err:
                print(f"[SCHEDULER WARNING] Printful sync failed: {pf_err}")

            # 5. Save back drop data with full options
            self.curator.save_drop(drop_data["filename"], drop_data)

            # 6. Update manifest last run timestamp
            manifest["scheduler"]["last_run_timestamp"] = now
            save_manifest(manifest)
            print(f"[SCHEDULER SUCCESS] Autonomous curation completed for {drop_data['filename']}.")
        except Exception as e:
            print(f"[SCHEDULER ERROR] Curation execution failed: {e}")

# Instantiate and start the scheduler
scheduler = CurationScheduler(curator, shopify, printful, MEMORY_SERVICE_URL)
scheduler.start()

@app.get("/health")
def health():
    manifest = load_manifest()
    sched = manifest.get("scheduler", {})
    return {
        "status": "online",
        "service": "latent-space-engine",
        "source_dir": MERCH_SOURCE_DIR,
        "memory_service": MEMORY_SERVICE_URL,
        "scheduler": {
            "enabled": sched.get("enabled", False),
            "current_profile": sched.get("current_profile"),
            "last_run": sched.get("last_run_timestamp", 0)
        }
    }

@app.post("/api/curate")
def curate_drop(profile_name: str = None):
    try:
        manifest = load_manifest()
        profile = None
        if profile_name:
            profile = manifest.get("profiles", {}).get(profile_name)
            if not profile:
                raise HTTPException(status_code=400, detail=f"Profile '{profile_name}' not found.")
        else:
            current_profile_name = manifest.get("scheduler", {}).get("current_profile")
            profile = manifest.get("profiles", {}).get(current_profile_name)

        # 1. Curate next drop image and save metadata to memory service
        drop_data = curator.curate_next_drop(profile=profile)
        if not drop_data:
            raise HTTPException(status_code=500, detail="Curation failed to select an image.")
        
        # Add timestamp
        now = time.time()
        drop_data["timestamp"] = now
        drop_data["formatted_date"] = datetime.now().isoformat()
        
        # 2. Archive expired drops on Shopify
        # shopify.delete_expired_drops()
        
        # Normalize local path for current OS environment
        local_path = drop_data.get("local_path")
        local_path = str(normalize_vault_path(local_path))
        
        # 3. Create the product on Shopify (with local path to upload the image)
        shopify_res = shopify.create_merch_product(drop_data, local_image_path=local_path)
        
        # Update drop data in memory with Shopify Product details
        drop_data["shopify_product_id"] = shopify_res.get("product_id")
        drop_data["shopify_variants"] = shopify_res.get("variants")
        drop_data["shopify_image_url"] = shopify_res.get("image_url")
        
        # 4. Sync to Printful automatically to generate mockups
        try:
            print("[SERVER] Triggering automatic Printful sync for mockups...")
            mockups = printful.create_print_draft(drop_data, shopify_res.get("image_url"))
            drop_data["printful_mockups"] = {
                "tee": mockups.get("tee_mockup"),
                "hoodie": mockups.get("hoodie_mockup")
            }
        except Exception as pf_err:
            print(f"[WARNING] Automatic Printful sync failed: {pf_err}")
            
        curator.save_drop(drop_data["filename"], drop_data)
        
        # Update manifest last run timestamp
        manifest["scheduler"]["last_run_timestamp"] = now
        save_manifest(manifest)
        
        return {
            "success": True,
            "drop": drop_data,
            "shopify_product_id": shopify_res.get("product_id"),
            "shopify_variants": shopify_res.get("variants"),
            "shopify_image_url": shopify_res.get("image_url"),
            "printful_mockups": drop_data.get("printful_mockups")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sync-printful")
def sync_printful():
    try:
        result = printful.sync_latest()
        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/catalog")
def get_catalog():
    try:
        history = curator.load_history()
        url = f"{MEMORY_SERVICE_URL}/api/documents/{curator.history_doc_id}/active"
        res = requests.get(url, timeout=5)
        catalog = []
        if res.status_code == 200:
            catalog = list(res.json().get("activeState", {}).values())
        return {
            "catalog": catalog
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Scheduler Control API Endpoints
@app.get("/api/scheduler/status")
def get_scheduler_status():
    manifest = load_manifest()
    if not manifest:
        raise HTTPException(status_code=500, detail="Manifest configuration not found.")
    
    sched = manifest.get("scheduler", {})
    now = time.time()
    last_run = sched.get("last_run_timestamp", 0)
    interval_hours = sched.get("interval_hours", 72)
    next_run = last_run + (interval_hours * 3600)
    time_remaining_sec = max(0, next_run - now)
    
    return {
        "enabled": sched.get("enabled", False),
        "interval_hours": interval_hours,
        "current_profile": sched.get("current_profile"),
        "last_run_timestamp": last_run,
        "last_run_formatted": datetime.fromtimestamp(last_run).isoformat() if last_run > 0 else "Never",
        "next_run_timestamp": next_run if last_run > 0 else 0,
        "next_run_formatted": datetime.fromtimestamp(next_run).isoformat() if last_run > 0 else "Never",
        "seconds_until_next_run": time_remaining_sec,
        "hours_until_next_run": round(time_remaining_sec / 3600, 2)
    }

class ToggleRequest(BaseModel):
    enabled: bool

@app.post("/api/scheduler/toggle")
def toggle_scheduler(req: ToggleRequest):
    manifest = load_manifest()
    if not manifest:
        raise HTTPException(status_code=500, detail="Manifest configuration not found.")
    manifest["scheduler"]["enabled"] = req.enabled
    save_manifest(manifest)
    return {"success": True, "enabled": req.enabled}

class ProfileRequest(BaseModel):
    profile: str

@app.post("/api/scheduler/profile")
def set_scheduler_profile(req: ProfileRequest):
    manifest = load_manifest()
    if not manifest:
        raise HTTPException(status_code=500, detail="Manifest configuration not found.")
    if req.profile not in manifest.get("profiles", {}):
        raise HTTPException(status_code=400, detail=f"Profile '{req.profile}' does not exist.")
    manifest["scheduler"]["current_profile"] = req.profile
    save_manifest(manifest)
    return {"success": True, "current_profile": req.profile}

@app.post("/api/scheduler/trigger")
def trigger_scheduler_now():
    try:
        return curate_drop()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5095))
    print(f"[CLE ENGINE] Starting latent-space-engine server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)

