#!/usr/bin/env python3
"""
Sovereign AutoMesh — Database Migration v2
Safely alters and upgrades ledger.db to support QuickBooks synchronization,
depreciation tracking, and preventative maintenance logs.
"""

import sqlite3
import os
import sys

DB_PATH = os.environ.get("DB_PATH", "/app/creative-liberation-engine/runtime/db/ledger.db")

# Allow local dev override
if len(sys.argv) > 1:
    DB_PATH = sys.argv[1]

def run_migration():
    print(f"[AutoMesh Migration] Target database: {DB_PATH}")
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Add new columns to trips table safely
    new_trip_cols = [
        ("exported_qb", "INTEGER DEFAULT 0"),
        ("qb_transaction_id", "VARCHAR(50)"),
        ("fuel_cost", "REAL DEFAULT 0.0"),
        ("other_expenses", "REAL DEFAULT 0.0")
    ]
    
    for col_name, col_type in new_trip_cols:
        try:
            cursor.execute(f"ALTER TABLE trips ADD COLUMN {col_name} {col_type}")
            print(f"[AutoMesh Migration] Added column '{col_name}' to 'trips' table")
        except sqlite3.OperationalError:
            # Column already exists, safe to ignore
            pass

    # 2. Add new columns to maintenance_log table safely
    new_maint_cols = [
        ("qb_expense_id", "VARCHAR(50)"),
        ("is_preventative", "INTEGER DEFAULT 1"),
        ("next_due_mileage", "REAL")
    ]
    
    for col_name, col_type in new_maint_cols:
        try:
            cursor.execute(f"ALTER TABLE maintenance_log ADD COLUMN {col_name} {col_type}")
            print(f"[AutoMesh Migration] Added column '{col_name}' to 'maintenance_log' table")
        except sqlite3.OperationalError:
            pass

    # 3. Create vehicle_depreciation table (for TCO)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vehicle_depreciation (
        vin VARCHAR(17) PRIMARY KEY,
        purchase_price REAL NOT NULL,
        purchase_date DATE NOT NULL,
        depreciation_method VARCHAR(20) DEFAULT 'STRAIGHT_LINE',
        useful_life_years INTEGER DEFAULT 5,
        residual_value REAL DEFAULT 0.0
    )
    """)
    print("[AutoMesh Migration] Ensured 'vehicle_depreciation' table exists")

    # 4. Create quickbooks_config table (for automated REST sync)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quickbooks_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        client_id TEXT,
        client_secret TEXT,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP,
        default_mileage_account TEXT DEFAULT '60000 Travel & Entertainment',
        default_bank_account TEXT DEFAULT '10000 Checking'
    )
    """)
    print("[AutoMesh Migration] Ensured 'quickbooks_config' table exists")
    
    # Seed default config if empty
    cursor.execute("SELECT COUNT(*) FROM quickbooks_config")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO quickbooks_config (id, default_mileage_account, default_bank_account)
        VALUES (1, '60000 Travel & Entertainment', '10000 Checking')
        """)
        print("[AutoMesh Migration] Seeded default quickbooks_config records")

    # Seed default vehicle depreciation profile if empty
    cursor.execute("SELECT COUNT(*) FROM vehicle_depreciation")
    if cursor.fetchone()[0] == 0:
        VIN = "JTEAAAAH9PJ121928"
        cursor.execute("""
        INSERT INTO vehicle_depreciation (vin, purchase_price, purchase_date, depreciation_method, useful_life_years, residual_value)
        VALUES (?, 45800.0, '2023-11-15', 'STRAIGHT_LINE', 5, 20000.0)
        """, (VIN,))
        print("[AutoMesh Migration] Seeded default vehicle depreciation profile")

    conn.commit()
    conn.close()
    print("[AutoMesh Migration] Database migration complete.")

if __name__ == "__main__":
    run_migration()
