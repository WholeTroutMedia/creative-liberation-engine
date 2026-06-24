#!/usr/bin/env python3
"""
Sovereign AutoMesh — SQLite Ledger Initialization
Seeds the mileage ledger database with schema and example trip data.
Idempotent: safe to run multiple times.
"""

import sqlite3
import os
import sys

DB_PATH = os.environ.get("DB_PATH", "/app/creative-liberation-engine/runtime/db/ledger.db")

# Allow local dev override
if len(sys.argv) > 1:
    DB_PATH = sys.argv[1]

SCHEMA = """
CREATE TABLE IF NOT EXISTS trips (
    trip_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vin VARCHAR(17) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    start_odo REAL NOT NULL,
    end_odo REAL NOT NULL,
    distance_miles REAL GENERATED ALWAYS AS (end_odo - start_odo) STORED,
    start_lat REAL,
    start_lon REAL,
    end_lat REAL,
    end_lon REAL,
    start_address TEXT,
    end_address TEXT,
    category VARCHAR(20) DEFAULT 'UNASSIGNED',
    business_percentage REAL DEFAULT 100.0,
    notes TEXT,
    exported INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS maintenance_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vin VARCHAR(17) NOT NULL,
    service_type VARCHAR(50) NOT NULL,
    mileage_at_service REAL NOT NULL,
    service_date DATE NOT NULL,
    cost REAL,
    provider TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS vehicle_snapshots (
    snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vin VARCHAR(17) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    odometer REAL,
    fuel_percent REAL,
    range_miles REAL,
    lat REAL,
    lon REAL,
    tire_fl REAL,
    tire_fr REAL,
    tire_rl REAL,
    tire_rr REAL
);
"""

VIN = "JTEAAAAH9PJ121928"
HOME_LAT = 40.946396
HOME_LON = -72.583240

SEED_TRIPS = [
    # (start_time, end_time, start_odo, end_odo, start_lat, start_lon, end_lat, end_lon, start_address, end_address, category, business_pct, notes)
    ("2026-05-24 07:15:00", "2026-05-24 08:30:00", 48475.0, 48511.0, HOME_LAT, HOME_LON, 40.8624, -73.6341, "Home, Riverhead NY", "Glen Cove, NY", "BUSINESS", 100.0, "Client consultation — Glen Cove production studio"),
    ("2026-05-23 14:30:00", "2026-05-23 15:00:00", 48467.0, 48475.0, HOME_LAT, HOME_LON, 40.9231, -72.6412, "Home, Riverhead NY", "Stop & Shop, Riverhead NY", "PERSONAL", 100.0, "Grocery run"),
    ("2026-05-22 09:00:00", "2026-05-22 11:45:00", 48390.0, 48467.0, HOME_LAT, HOME_LON, 40.7580, -73.9855, "Home, Riverhead NY", "Client Studio, Manhattan NY", "BUSINESS", 100.0, "Full-day production session — Midtown"),
    ("2026-05-21 11:45:00", "2026-05-21 13:30:00", 48362.0, 48390.0, HOME_LAT, HOME_LON, 40.8156, -73.0482, "Home, Riverhead NY", "B&H Equipment + Lunch, Huntington NY", "BUSINESS", 70.0, "Equipment pickup with personal lunch stop"),
    ("2026-05-20 08:30:00", "2026-05-20 12:00:00", 48270.0, 48362.0, HOME_LAT, HOME_LON, 40.7484, -73.9857, "Home, Riverhead NY", "Manhattan Production Office, NY", "BUSINESS", 100.0, "Production office — Penn Station area"),
    ("2026-05-19 18:00:00", "2026-05-19 19:15:00", 48258.0, 48270.0, HOME_LAT, HOME_LON, 40.9340, -72.5910, "Home, Riverhead NY", "Dinner + CVS Pharmacy, Riverhead NY", "PERSONAL", 100.0, "Dinner and pharmacy pickup"),
    ("2026-05-18 10:00:00", "2026-05-18 12:30:00", 48215.0, 48258.0, HOME_LAT, HOME_LON, 40.7900, -73.1350, "Home, Riverhead NY", "Unassigned destination", "UNASSIGNED", 100.0, None),
]

SEED_MAINTENANCE = [
    # (service_type, mileage, date, cost, provider, notes)
    ("Oil Change", 45200.0, "2026-03-15", 89.99, "Valvoline Instant Oil Change", "Full synthetic 0W-20"),
    ("Tire Rotation", 46800.0, "2026-04-20", 0.0, "Toyota of Riverhead", "Free with service plan"),
    ("Cabin Air Filter", 44000.0, "2026-01-10", 34.99, "Self — Amazon OEM part", "Replaced with OEM Denso filter"),
]

SEED_SNAPSHOTS = [
    # (timestamp, odometer, fuel_pct, range, lat, lon, fl, fr, rl, rr)
    ("2026-05-24 15:34:38", 48511.0, 60.0, 226.0, HOME_LAT, HOME_LON, 36.0, 37.0, 36.0, 36.0),
    ("2026-05-23 15:00:00", 48475.0, 72.0, 270.0, HOME_LAT, HOME_LON, 36.0, 37.0, 36.0, 36.0),
    ("2026-05-22 11:45:00", 48467.0, 45.0, 169.0, 40.7580, -73.9855, 35.0, 36.0, 35.0, 35.0),
    ("2026-05-21 13:30:00", 48390.0, 55.0, 207.0, HOME_LAT, HOME_LON, 36.0, 37.0, 36.0, 36.0),
    ("2026-05-20 12:00:00", 48362.0, 38.0, 143.0, 40.7484, -73.9857, 35.0, 36.0, 35.0, 35.0),
    ("2026-05-19 19:15:00", 48270.0, 65.0, 244.0, HOME_LAT, HOME_LON, 36.0, 37.0, 36.0, 36.0),
    ("2026-05-18 12:30:00", 48258.0, 70.0, 263.0, HOME_LAT, HOME_LON, 36.0, 37.0, 36.0, 36.0),
]


def init_database():
    """Create tables and seed example data."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create tables
    cursor.executescript(SCHEMA)
    print(f"[AutoMesh] Schema created at {DB_PATH}")

    # Seed trips (only if table is empty)
    cursor.execute("SELECT COUNT(*) FROM trips")
    if cursor.fetchone()[0] == 0:
        for t in SEED_TRIPS:
            cursor.execute("""
                INSERT INTO trips (vin, start_time, end_time, start_odo, end_odo,
                    start_lat, start_lon, end_lat, end_lon,
                    start_address, end_address, category, business_percentage, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (VIN, *t))
        print(f"[AutoMesh] Seeded {len(SEED_TRIPS)} trips")
    else:
        print("[AutoMesh] Trips table already populated, skipping seed")

    # Seed maintenance
    cursor.execute("SELECT COUNT(*) FROM maintenance_log")
    if cursor.fetchone()[0] == 0:
        for m in SEED_MAINTENANCE:
            cursor.execute("""
                INSERT INTO maintenance_log (vin, service_type, mileage_at_service, service_date, cost, provider, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (VIN, *m))
        print(f"[AutoMesh] Seeded {len(SEED_MAINTENANCE)} maintenance records")

    # Seed snapshots
    cursor.execute("SELECT COUNT(*) FROM vehicle_snapshots")
    if cursor.fetchone()[0] == 0:
        for s in SEED_SNAPSHOTS:
            cursor.execute("""
                INSERT INTO vehicle_snapshots (vin, timestamp, odometer, fuel_percent, range_miles,
                    lat, lon, tire_fl, tire_fr, tire_rl, tire_rr)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (VIN, *s))
        print(f"[AutoMesh] Seeded {len(SEED_SNAPSHOTS)} vehicle snapshots")

    conn.commit()
    conn.close()
    print("[AutoMesh] Database initialization complete.")


if __name__ == "__main__":
    init_database()
