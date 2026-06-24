#!/usr/bin/env python3
"""
Sovereign AutoMesh: Refueling Detection & Backtracker
Processes vehicle snapshots to detect refuel events, geocodes them,
finds nearby gas stations via Overpass API, estimates cash prices,
and links them to trips in the SQLite database.
"""

import os
import sys
import json
import sqlite3
import logging
import requests
import math
from datetime import datetime, timedelta

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] AutoMesh-Refuel: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(os.path.dirname(__file__), '../build.log'))
    ]
)

scripts_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(scripts_dir)

try:
    import toyota_telemetry_harvest
except ImportError as e:
    logging.error(f"Failed to import required scripts: {e}")
    sys.exit(1)

DB_PATH = toyota_telemetry_harvest.get_resolved_path("/app/creative-liberation-engine/runtime/db/ledger.db")
VENZA_TANK_CAPACITY = 14.5 # Gallons

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate great-circle distance between two points in meters."""
    try:
        r = 6371000 # Earth radius in meters
        phi1 = math.radians(float(lat1))
        phi2 = math.radians(float(lat2))
        d_phi = math.radians(float(lat2 - lat1))
        d_lon = math.radians(float(lon2 - lon1))
        a = math.sin(d_phi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(d_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return r * c
    except Exception:
        return 999999.0

def find_closest_gas_station(lat, lon):
    """Query Overpass API for the nearest gas station within 10km with retries."""
    if not lat or not lon:
        return "Unknown Gas Station"
    
    url = 'https://overpass-api.de/api/interpreter'
    query = f"[out:json];node(around:10000, {lat}, {lon})[amenity=fuel];out;"
    headers = {'User-Agent': 'CLEEngine/1.0 (inquiries@creativeliberationengine.org)'}
    
    import time
    for attempt in range(1, 4):
        try:
            logging.info(f"Overpass: Querying nearest gas station (Attempt {attempt}/3)...")
            resp = requests.post(url, data=query, headers=headers, timeout=20)
            if resp.status_code == 200:
                elements = resp.json().get('elements', [])
                if not elements:
                    return "Unknown Gas Station"
                    
                stations = []
                for e in elements:
                    s_lat = e.get('lat')
                    s_lon = e.get('lon')
                    s_name = e.get('tags', {}).get('name', 'Gas Station')
                    dist = haversine_distance(lat, lon, s_lat, s_lon)
                    stations.append((s_name, dist))
                    
                stations.sort(key=lambda x: x[1])
                closest_name = stations[0][0]
                logging.info(f"Overpass: Found closest gas station '{closest_name}' ({stations[0][1]:.1f}m away)")
                return closest_name
            elif resp.status_code in (429, 504):
                logging.warning(f"Overpass: Server returned status {resp.status_code} (busy/rate limited). Retrying in 3 seconds...")
                time.sleep(3)
            else:
                logging.warning(f"Overpass API returned status {resp.status_code}: {resp.text}")
                return "Unknown Gas Station"
        except Exception as e:
            logging.error(f"Failed to query Overpass API (attempt {attempt}): {e}")
            if attempt < 3:
                time.sleep(3)
                
    return "Unknown Gas Station"

def estimate_cash_price(address):
    """Estimate cash price per gallon based on New York / New Jersey averages."""
    if not address:
        return 4.26 # Default to NY cash price
        
    addr_lower = address.lower()
    if "new jersey" in addr_lower or ", nj" in addr_lower:
        # NJ average cash price in June 2026: $4.10 - $0.10 cash discount = $4.00
        return 4.00
    elif "new york" in addr_lower or ", ny" in addr_lower:
        # NY average cash price in June 2026: $4.36 - $0.10 cash discount = $4.26
        return 4.26
    else:
        # Fallback national average
        return 3.80

def get_linked_trip(cursor, odo, refuel_time_str):
    """Find the trip corresponding to the refueling event."""
    try:
        # Refuel odometer should be close to either the start or end odometer of a trip,
        # or the refuel time should fall within or very close to a trip
        refuel_dt = datetime.strptime(refuel_time_str, "%Y-%m-%d %H:%M:%S")
        
        cursor.execute("SELECT * FROM trips")
        trips = [dict(row) for row in cursor.fetchall()]
        
        # Sort trips by proximity to the refueling event odo/timestamp
        matches = []
        for t in trips:
            start_odo = t["start_odo"]
            end_odo = t["end_odo"]
            start_time = datetime.strptime(t["start_time"], "%Y-%m-%d %H:%M:%S")
            end_time = datetime.strptime(t["end_time"], "%Y-%m-%d %H:%M:%S")
            
            # Check odo proximity
            odo_dist = min(abs(odo - start_odo), abs(odo - end_odo))
            
            # Check time proximity (minutes)
            time_dist = min(abs((refuel_dt - start_time).total_seconds()), abs((refuel_dt - end_time).total_seconds())) / 60.0
            
            # Match criteria: odo within 2 miles, or time within 60 minutes
            if odo_dist <= 2.5 or time_dist <= 60.0:
                score = odo_dist * 10 + time_dist
                matches.append((t, score))
                
        if matches:
            matches.sort(key=lambda x: x[1])
            matched_trip = matches[0][0]
            logging.info(f"Linked refuel event at odo {odo} to Trip ID {matched_trip['trip_id']} ({matched_trip['start_time']} -> {matched_trip['end_time']})")
            return matched_trip
    except Exception as e:
        logging.error(f"Error linking refuel to trip: {e}")
    return None

def detect_and_backfill():
    if not os.path.exists(DB_PATH):
        logging.error(f"Database not found at {DB_PATH}")
        return False
        
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Clear existing refuel logs to rebuild them from scratch
    cursor.execute("DELETE FROM refuelings")
    cursor.execute("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'refuelings'")
    cursor.execute("UPDATE trips SET fuel_cost = 0.0")
    conn.commit()
    
    # Retrieve all snapshots sorted chronologically
    cursor.execute("SELECT * FROM vehicle_snapshots ORDER BY snapshot_id ASC")
    snapshots = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    logging.info(f"Analyzing {len(snapshots)} snapshots for refuel events...")
    
    refuelings_found = []
    last_fuel = None
    last_odo = None
    
    for snap in snapshots:
        snap_id = snap["snapshot_id"]
        ts = snap["timestamp"]
        odo = snap["odometer"]
        fuel = snap["fuel_percent"]
        lat = snap["lat"]
        lon = snap["lon"]
        
        # Check if fuel has been filled (fuel_percent increased by > 15% from previous valid reading)
        if last_fuel is not None and fuel is not None and last_odo is not None and odo is not None:
            if fuel > last_fuel + 15.0:
                refuelings_found.append({
                    "snapshot_id": snap_id,
                    "timestamp": ts,
                    "odometer": odo,
                    "prev_fuel": last_fuel,
                    "curr_fuel": fuel,
                    "lat": lat,
                    "lon": lon
                })
        
        # Update last state tracking if they are valid values
        if fuel is not None:
            last_fuel = fuel
        if odo is not None:
            last_odo = odo

    logging.info(f"Detected {len(refuelings_found)} historical refuel events. Enriching...")
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    db_cursor = conn.cursor()
    
    inserted_count = 0
    for rf in refuelings_found:
        fuel_diff = rf["curr_fuel"] - rf["prev_fuel"]
        gallons_added = (fuel_diff / 100.0) * VENZA_TANK_CAPACITY
        
        # Geocode the location
        address = toyota_telemetry_harvest.reverse_geocode(rf["lat"], rf["lon"]) or "Unknown Location"
        
        # Query closest gas station
        station_name = find_closest_gas_station(rf["lat"], rf["lon"])
        
        # Estimate cash price
        price = estimate_cash_price(address)
        cost = gallons_added * price
        
        # Try to link to a trip
        linked_trip = get_linked_trip(db_cursor, rf["odometer"], rf["timestamp"])
        trip_id = linked_trip["trip_id"] if linked_trip else None
        
        # Log to refuelings table
        db_cursor.execute("""
            INSERT INTO refuelings (snapshot_id, timestamp, odometer, prev_fuel, curr_fuel,
                fuel_added_percent, gallons_added, lat, lon, station_name, price_per_gallon, estimated_cost, trip_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rf["snapshot_id"],
            rf["timestamp"],
            rf["odometer"],
            rf["prev_fuel"],
            rf["curr_fuel"],
            fuel_diff,
            gallons_added,
            rf["lat"],
            rf["lon"],
            station_name,
            price,
            cost,
            trip_id
        ))
        
        # If linked to a trip, update the trip's fuel_cost
        if trip_id:
            db_cursor.execute(
                "UPDATE trips SET fuel_cost = ? WHERE trip_id = ?",
                (cost, trip_id)
            )
            
        inserted_count += 1
        logging.info(f"Refuel Logged: {rf['timestamp']} | Odo: {rf['odometer']} | Added: {gallons_added:.2f} gal at {station_name} | Cost: ${cost:.2f} | Trip Link: {trip_id}")
        
        # Rate-limiting delay to respect Overpass API limits
        import time
        time.sleep(2)
        
    conn.commit()
    conn.close()
    
    logging.info(f"Backfill complete: {inserted_count} refueling events logged.")
    
    try:
        import allocate_fuel_costs
        allocate_fuel_costs.allocate()
    except Exception as ae:
        logging.error(f"Failed to trigger fuel cost allocation: {ae}")
        
    return True

if __name__ == "__main__":
    detect_and_backfill()
