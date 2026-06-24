import asyncio
import os
import sys
import logging
import sqlite3

# Add paths to sys.path
sys.path.append(os.path.dirname(__file__))
sys.path.append(os.path.join(os.path.dirname(__file__), "../surfaces/automesh"))

from api.accounting import QuickBooksSyncService

DB_PATH = os.environ.get("DB_PATH", "/app/creative-liberation-engine/runtime/db/ledger.db")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

async def sync_all():
    if not os.path.exists(DB_PATH):
        logging.error(f"Database not found at {DB_PATH}")
        return
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT trip_id FROM trips WHERE category = 'BUSINESS' AND (exported_qb = 0 OR exported_qb IS NULL)")
    rows = cursor.fetchall()
    conn.close()
    
    trip_ids = [r[0] for r in rows]
    logging.info(f"Found {len(trip_ids)} pending business trips to sync to QuickBooks.")
    
    if not trip_ids:
        logging.info("No pending trips to sync.")
        return
        
    service = QuickBooksSyncService(DB_PATH)
    success_count = 0
    
    for idx, trip_id in enumerate(trip_ids, 1):
        logging.info(f"[{idx}/{len(trip_ids)}] Syncing Trip ID {trip_id}...")
        try:
            status, qb_id = await service.sync_trip(trip_id)
            logging.info(f"  Successfully synced. Journal Entry ID: {qb_id}")
            success_count += 1
            # Add a small rate limit delay
            await asyncio.sleep(0.5)
        except Exception as e:
            logging.error(f"  Failed to sync Trip ID {trip_id}: {e}")
            
    logging.info(f"Sync complete. Successfully synced {success_count} out of {len(trip_ids)} trips.")

if __name__ == "__main__":
    asyncio.run(sync_all())
