#!/usr/bin/env python3
"""
Sovereign AutoMesh: Proportional Fuel Allocation Engine
Partitions trips into refueling tank cycles and allocates fuel usage and costs
proportionally based on distance.
"""

import os
import sys
import sqlite3
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] AutoMesh-FuelAlloc: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(os.path.dirname(__file__), '../build.log'))
    ]
)

def get_resolved_path(unix_path):
    if os.name == 'nt':
        return unix_path.replace("/app/creative-liberation-engine/", "y:\\creative-liberation-engine\\").replace("/", "\\")
    return unix_path

DB_PATH = get_resolved_path("/app/creative-liberation-engine/runtime/db/ledger.db")
FALLBACK_MPG = 40.0
FALLBACK_PRICE = 4.26

def allocate():
    if not os.path.exists(DB_PATH):
        logging.error(f"Database not found at {DB_PATH}")
        return False

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Run migrations to ensure columns exist
    try:
        cursor.execute("ALTER TABLE trips ADD COLUMN allocated_fuel_gallons REAL DEFAULT 0.0")
        logging.info("Migration: Added allocated_fuel_gallons to trips table.")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE trips ADD COLUMN allocated_fuel_cost REAL DEFAULT 0.0")
        logging.info("Migration: Added allocated_fuel_cost to trips table.")
    except sqlite3.OperationalError:
        pass
    conn.commit()

    # 2. Fetch all refuelings ordered by odometer
    cursor.execute("SELECT refueling_id, timestamp, odometer, prev_fuel, curr_fuel, gallons_added, estimated_cost, price_per_gallon FROM refuelings ORDER BY odometer ASC")
    refuelings = [dict(row) for row in cursor.fetchall()]

    # 3. Fetch all trips ordered by end odometer
    cursor.execute("SELECT trip_id, start_time, end_time, start_odo, end_odo, distance_miles FROM trips ORDER BY end_odo ASC")
    trips = [dict(row) for row in cursor.fetchall()]

    logging.info(f"Allocating fuel across {len(trips)} trips using {len(refuelings)} refuel events...")

    # 4. Group trips by refueling cycle
    # Cycle index matches index in refuelings list.
    # index len(refuelings) is the active cycle after the last refuel.
    cycles = {i: [] for i in range(len(refuelings) + 1)}

    for t in trips:
        assigned = False
        for idx, rf in enumerate(refuelings):
            if t["end_odo"] <= rf["odometer"]:
                cycles[idx].append(t)
                assigned = True
                break
        if not assigned:
            cycles[len(refuelings)].append(t)

    # 5. Process each cycle and update the database
    updates = []

    for idx, rf in enumerate(refuelings):
        cycle_trips = cycles[idx]
        total_dist = sum(t["distance_miles"] for t in cycle_trips)
        
        logging.info(f"Cycle {idx + 1}/{len(refuelings)}: Refuel at Odo {rf['odometer']} | Added {rf['gallons_added']:.2f} gal | Estimated Cost: ${rf['estimated_cost']:.2f} | Distance driven: {total_dist:.1f} mi")

        if total_dist > 0:
            for t in cycle_trips:
                pct = t["distance_miles"] / total_dist
                allocated_fuel = rf["gallons_added"] * pct
                allocated_cost = rf["estimated_cost"] * pct
                updates.append((allocated_fuel, allocated_cost, t["trip_id"]))
        else:
            logging.warning(f"No recorded trips found for Cycle {idx + 1}. Fuel cannot be allocated.")

    # 6. Process the active cycle (after the last refuel event)
    active_trips = cycles[len(refuelings)]
    if active_trips:
        price = refuelings[-1]["price_per_gallon"] if refuelings else FALLBACK_PRICE
        logging.info(f"Active Cycle: Allocating for {len(active_trips)} trips since last refuel using fallback {FALLBACK_MPG} MPG and ${price:.2f}/gal.")
        for t in active_trips:
            allocated_fuel = t["distance_miles"] / FALLBACK_MPG
            allocated_cost = allocated_fuel * price
            updates.append((allocated_fuel, allocated_cost, t["trip_id"]))

    # 7. Write allocation updates to the database
    for allocated_fuel, allocated_cost, trip_id in updates:
        cursor.execute("""
            UPDATE trips
            SET allocated_fuel_gallons = ?, allocated_fuel_cost = ?
            WHERE trip_id = ?
        """, (allocated_fuel, allocated_cost, trip_id))

    conn.commit()
    conn.close()
    logging.info(f"Successfully allocated fuel metrics to {len(updates)} trips in the database.")
    return True

if __name__ == "__main__":
    allocate()
