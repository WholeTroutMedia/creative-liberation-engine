#!/usr/bin/env python3
"""
Sovereign AutoMesh: Historical Trip Backfiller & Enricher
Processes existing trips in the SQLite database, reverse geocodes coordinates,
queries calendar/gmail context, and rewrites the Google Sheet Mileage Ledger.
"""

import os
import sys
import time
import sqlite3
import logging
import asyncio
import requests

# Setup logging conforming to CLE V6 specifications
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] AutoMesh-Backfill: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(os.path.dirname(__file__), '../build.log'))
    ]
)

# Append script directory to path to enable imports
scripts_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(scripts_dir)

try:
    import toyota_telemetry_harvest
    import sync_toyota_google_sheets
except ImportError as e:
    logging.error(f"Failed to import required scripts: {e}")
    sys.exit(1)

# Retrieve resolved paths
DB_PATH = toyota_telemetry_harvest.get_resolved_path("/app/creative-liberation-engine/runtime/db/ledger.db")
CREDS_PATH = toyota_telemetry_harvest.get_resolved_path("/app/creative-liberation-engine/runtime/session/credentials/inquiries@creativeliberationengine.org.json")
SPREADSHEET_ID = sync_toyota_google_sheets.SPREADSHEET_ID
SHEET_TITLE = sync_toyota_google_sheets.SHEET_TITLE

# Caching mechanism to prevent Nominatim rate-limiting
geocode_cache = {}
original_reverse_geocode = toyota_telemetry_harvest.reverse_geocode

def cached_reverse_geocode(lat, lon):
    if lat is None or lon is None:
        return None
    # Round coordinates to 4 decimal places (~11 meters) to consolidate nearby endpoints
    key = (round(float(lat), 4), round(float(lon), 4))
    if key in geocode_cache:
        logging.info(f"Cache HIT for coordinates ({lat:.6f}, {lon:.6f}) -> '{geocode_cache[key]}'")
        return geocode_cache[key]
    
    logging.info(f"Cache MISS for coordinates ({lat:.6f}, {lon:.6f}). Querying Nominatim...")
    addr = original_reverse_geocode(lat, lon)
    geocode_cache[key] = addr
    # Strictly respect Nominatim API terms (max 1 req/sec)
    time.sleep(1.2)
    return addr

# Monkey-patch the geocoder in the harvester module
toyota_telemetry_harvest.reverse_geocode = cached_reverse_geocode

def clear_google_sheets_ledger():
    """Clear all data rows (except the header) in Sheet 2 (Mileage Ledger)."""
    logging.info("Refreshing Google Workspace OAuth2 Token...")
    token = sync_toyota_google_sheets.load_google_token()
    if not token:
        logging.error("Failed to load Google token. Cannot clear sheet.")
        return False
        
    logging.info(f"Clearing spreadsheet '{SHEET_TITLE}' data rows (A2:K1000)...")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{SHEET_TITLE}!A2:K1000:clear"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    try:
        resp = requests.post(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            logging.info("Google Sheets Mileage Ledger cleared successfully.")
            return True
        else:
            logging.error(f"Failed to clear Google Sheets: {resp.text}")
            return False
    except Exception as e:
        logging.error(f"Error calling clear endpoint: {e}")
        return False

def is_resolved_address(addr):
    if not addr:
        return False
    addr_lower = addr.strip().lower()
    if addr_lower.startswith("previous location"):
        return False
    if addr_lower.startswith("destination"):
        return False
    if addr_lower == "home, riverhead ny":
        return False
    return True

def backfill_db_trips():
    """Iterate through all database trips, enrich them, and update database."""
    if not os.path.exists(DB_PATH):
        logging.error(f"SQLite Database not found at {DB_PATH}")
        return False
        
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Retrieve all trips to backfill
    cursor.execute("SELECT * FROM trips ORDER BY start_time ASC")
    trips = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    # Pre-populate geocode cache from already resolved addresses in the DB
    logging.info("Pre-populating geocoding cache from database resolved addresses...")
    for trip in trips:
        start_lat = trip["start_lat"]
        start_lon = trip["start_lon"]
        end_lat = trip["end_lat"]
        end_lon = trip["end_lon"]
        start_addr = trip["start_address"]
        end_addr = trip["end_address"]
        
        if start_lat is not None and start_lon is not None and is_resolved_address(start_addr):
            key = (round(float(start_lat), 4), round(float(start_lon), 4))
            if key not in geocode_cache:
                geocode_cache[key] = start_addr
                
        if end_lat is not None and end_lon is not None and is_resolved_address(end_addr):
            key = (round(float(end_lat), 4), round(float(end_lon), 4))
            if key not in geocode_cache:
                geocode_cache[key] = end_addr
                
    logging.info(f"Geocoding cache pre-seeded with {len(geocode_cache)} unique locations.")
    logging.info(f"Found {len(trips)} historical trips to process.")
    
    updated_count = 0
    for idx, trip in enumerate(trips, 1):
        trip_id = trip["trip_id"]
        start_lat = trip["start_lat"]
        start_lon = trip["start_lon"]
        end_lat = trip["end_lat"]
        end_lon = trip["end_lon"]
        start_time = trip["start_time"]
        end_time = trip["end_time"]
        
        logging.info(f"[{idx}/{len(trips)}] Processing Trip ID {trip_id} ({start_time} to {end_time})")
        
        if not all([start_lat, start_lon, end_lat, end_lon]):
            logging.warning(f"Trip ID {trip_id} has missing coordinates, skipping.")
            continue
            
        try:
            # Perform address geocoding and context enrichment
            start_address, end_address, category, business_pct, notes = toyota_telemetry_harvest.classify_and_enrich_trip(
                start_lat, start_lon, end_lat, end_lon, start_time, end_time, trip["distance_miles"]
            )
            
            # Save updates back to database
            conn = sqlite3.connect(DB_PATH)
            db_cursor = conn.cursor()
            db_cursor.execute("""
                UPDATE trips
                SET start_address = ?,
                    end_address = ?,
                    category = ?,
                    business_percentage = ?,
                    notes = ?
                WHERE trip_id = ?
            """, (start_address, end_address, category, business_pct, notes, trip_id))
            conn.commit()
            conn.close()
            
            logging.info(f"Trip ID {trip_id} updated: {start_address[:30]}... -> {end_address[:30]}... | Cat: {category} | Notes: {notes}")
            updated_count += 1
            
        except Exception as e:
            logging.error(f"Error processing Trip ID {trip_id}: {e}")
            
    logging.info(f"Database backfill complete. {updated_count} trips updated.")
    return True

async def main():
    logging.info("Starting historical trip backfill and enrichment process...")
    
    # 1. Backfill and enrich SQLite database trips
    success = backfill_db_trips()
    if not success:
        logging.error("Backfill aborted due to DB errors.")
        return
        
    # 2. Clear Google Sheet ledger rows
    cleared = clear_google_sheets_ledger()
    if not cleared:
        logging.error("Sheet clear failed. Aborting Google Sheet rewrite.")
        return
        
    # 3. Trigger sheet synchronization to rebuild ledger with enriched data
    logging.info("Triggering Google Sheets sync to rebuild ledger...")
    await sync_toyota_google_sheets.sync()
    logging.info("Historical trip backfill and Google Sheet sync completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
