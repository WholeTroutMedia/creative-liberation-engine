import sqlite3
import os
import sys

db_path = "/app/creative-liberation-engine/runtime/db/ledger.db"
if not os.path.exists(db_path):
    db_path = "y:/creative-liberation-engine/runtime/db/ledger.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS refuelings (
    refueling_id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER,
    timestamp TIMESTAMP NOT NULL,
    odometer REAL NOT NULL,
    prev_fuel REAL NOT NULL,
    curr_fuel REAL NOT NULL,
    fuel_added_percent REAL NOT NULL,
    gallons_added REAL NOT NULL,
    lat REAL,
    lon REAL,
    station_name TEXT,
    price_per_gallon REAL,
    estimated_cost REAL,
    trip_id INTEGER,
    FOREIGN KEY(snapshot_id) REFERENCES vehicle_snapshots(snapshot_id),
    FOREIGN KEY(trip_id) REFERENCES trips(trip_id)
);
""")

try:
    cursor.execute("ALTER TABLE trips ADD COLUMN fuel_cost REAL DEFAULT 0.0")
except sqlite3.OperationalError:
    pass

try:
    cursor.execute("ALTER TABLE trips ADD COLUMN other_expenses REAL DEFAULT 0.0")
except sqlite3.OperationalError:
    pass

conn.commit()
conn.close()
print("Successfully verified/created refuelings table and fuel_cost columns in trips table.")
