#!/usr/bin/env python3
"""
Sovereign AutoMesh — Google Sheets & SQLite Bidirectional Sync
Synchronizes the 'Mileage Ledger' sheet (Sheet 2) with the SQLite database.
Detects user-made categorization changes on Google Sheets (WORK vs PERSONAL)
and propagates them back to the database, auto-syncing to QuickBooks when marked WORK.
"""

import os
import sys
import json
import sqlite3
import logging
import requests
from datetime import datetime, timedelta

# Setup logging conforming to CLE V6 specifications
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] AutoMesh-Sheets-Sync: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(os.path.dirname(__file__), '../build.log'))
    ]
)

def get_resolved_path(unix_path):
    if os.name == 'nt':
        return unix_path.replace("/app/creative-liberation-engine/", "y:\\creative-liberation-engine\\").replace("/", "\\")
    return unix_path

def get_env_var(name):
    val = os.getenv(name)
    if val:
        return val
    env_file = get_resolved_path("/app/creative-liberation-engine/.env")
    if os.path.exists(env_file):
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' in line:
                        k, v = line.split('=', 1)
                        if k.strip() == name:
                            return v.strip().strip('"').strip("'")
        except Exception as e:
            logging.error(f"Error reading .env file: {e}")
    return None

def get_google_creds_path():
    personal_path = get_resolved_path("/app/creative-liberation-engine/runtime/session/credentials/inquiries@creativeliberationengine.org.json")
    if os.path.exists(personal_path):
        return personal_path
    return get_resolved_path("/app/creative-liberation-engine/runtime/session/credentials/inquiries@creativeliberationengine.org.json")

DB_PATH = get_resolved_path("/app/creative-liberation-engine/runtime/db/ledger.db")
CREDS_PATH = get_google_creds_path()
SPREADSHEET_ID = "1S309ogUDTbFkZKMWpdFI2ABd5iaerHF8AtG_zq0b-Dg"
SHEET_TITLE = "Mileage Ledger"

def load_token_from_file(creds_path, is_personal=False, force_refresh=False):
    """Load credentials and refresh the token if expired from a specific file path."""
    if not os.path.exists(creds_path):
        return None
    try:
        with open(creds_path, 'r') as f:
            creds = json.load(f)
            
        token = creds.get("token")
        refresh_token = creds.get("refresh_token")
        client_id = creds.get("client_id")
        client_secret = creds.get("client_secret")
        expiry_str = creds.get("expiry")
        
        # Fallback to environment variables if missing in JSON
        if not client_id:
            client_id = get_env_var("GMAIL_CLIENT_ID") if is_personal else get_env_var("GOOGLE_OAUTH_CLIENT_ID")
        if not client_secret:
            client_secret = get_env_var("GMAIL_CLIENT_SECRET") if is_personal else get_env_var("GOOGLE_OAUTH_CLIENT_SECRET")
        if not refresh_token:
            refresh_token = get_env_var("GMAIL_REFRESH_TOKEN") if is_personal else None
        
        is_expired = True
        if expiry_str and not force_refresh:
            try:
                clean_expiry = expiry_str.split(".")[0]
                expiry_dt = datetime.fromisoformat(clean_expiry)
                if datetime.utcnow() < expiry_dt:
                    is_expired = False
            except Exception:
                pass
                
        if (is_expired or force_refresh) and refresh_token:
            logging.info(f"Google Workspace Token: Refreshing OAuth2 token for {os.path.basename(creds_path)}...")
            refresh_url = "https://oauth2.googleapis.com/token"
            payload = {
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token"
            }
            resp = requests.post(refresh_url, data=payload, timeout=10)
            if resp.status_code == 200:
                resp_data = resp.json()
                token = resp_data.get("access_token")
                creds["token"] = token
                creds["client_id"] = client_id
                creds["client_secret"] = client_secret
                creds["refresh_token"] = refresh_token
                expires_in = resp_data.get("expires_in", 3600)
                new_expiry = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
                creds["expiry"] = new_expiry
                with open(creds_path, 'w') as f:
                    json.dump(creds, f, indent=2)
                logging.info(f"Google Workspace Token: Token successfully refreshed for {os.path.basename(creds_path)}!")
            else:
                logging.warning(f"Google Workspace Token: Refresh failed for {os.path.basename(creds_path)}: {resp.text}")
                return None
        return token
    except Exception as e:
        logging.warning(f"Failed to load token from {creds_path}: {e}")
        return None

def load_google_token(force_refresh=False):
    """Load Google OAuth token with fallback from personal to CORTEX."""
    personal_path = get_resolved_path("/app/creative-liberation-engine/runtime/session/credentials/inquiries@creativeliberationengine.org.json")
    cortex_path = get_resolved_path("/app/creative-liberation-engine/runtime/session/credentials/inquiries@creativeliberationengine.org.json")
    
    token = load_token_from_file(personal_path, is_personal=True, force_refresh=force_refresh)
    if token:
        return token
        
    logging.info("Google Sheets API: Falling back to CORTEX credentials...")
    return load_token_from_file(cortex_path, is_personal=False, force_refresh=force_refresh)

def get_sheet_metadata(token):
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}"
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code == 200:
        return resp.json()
    else:
        logging.error(f"Failed to fetch spreadsheet metadata: {resp.text}")
        return None

BARNSTORM_TITLE = "Barnstorm"
NFS_TITLE = "North Fork Sun"
REFUELINGS_TITLE = "Refuelings"

def create_mileage_sheet(token, title):
    """Create a mileage ledger sheet with headers and Category dropdown validation."""
    logging.info(f"Creating '{title}' sheet in Google Sheets...")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}:batchUpdate"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # 1. Add sheet
    add_payload = {
        "requests": [
            {
                "addSheet": {
                    "properties": {
                        "title": title,
                        "gridProperties": {
                            "rowCount": 1000,
                            "columnCount": 13
                        }
                    }
                }
            }
        ]
    }
    resp = requests.post(url, headers=headers, json=add_payload, timeout=10)
    if resp.status_code != 200:
        logging.error(f"Failed to add sheet '{title}': {resp.text}")
        return None
        
    res_data = resp.json()
    sheet_id = res_data["replies"][0]["addSheet"]["properties"]["sheetId"]
    logging.info(f"Created sheet '{title}' with ID: {sheet_id}")
    
    # 2. Write headers
    headers_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{title}!A1:M1?valueInputOption=RAW"
    header_payload = {
        "values": [[
            "Trip ID", "Date", "Distance (mi)", "Start Odometer", "End Odometer", 
            "Start Location", "End Location", "Category", "Notes", "QB Sync Status", "QB Transaction ID",
            "Fuel Used (gal)", "Fuel Cost ($)"
        ]]
    }
    resp = requests.put(headers_url, headers=headers, json=header_payload, timeout=10)
    if resp.status_code != 200:
        logging.error(f"Failed to write headers to '{title}': {resp.text}")
        
    # 3. Add data validation for Column H (Category) - 0-indexed index 7
    validation_payload = {
        "requests": [
            {
                "setDataValidation": {
                    "range": {
                        "sheetId": sheet_id,
                        "startRowIndex": 1,
                        "endRowIndex": 1000,
                        "startColumnIndex": 7,
                        "endColumnIndex": 8
                    },
                    "rule": {
                        "condition": {
                            "type": "ONE_OF_LIST",
                            "values": [
                                {"userEnteredValue": "WORK"},
                                {"userEnteredValue": "PERSONAL"},
                                {"userEnteredValue": "UNASSIGNED"}
                            ]
                        },
                        "showCustomUi": True,
                        "strict": True
                    }
                }
            }
        ]
    }
    resp = requests.post(url, headers=headers, json=validation_payload, timeout=10)
    if resp.status_code == 200:
        logging.info(f"Successfully added dropdown data validation for Column H in '{title}'.")
    else:
        logging.error(f"Failed to add data validation to '{title}': {resp.text}")
        
    return sheet_id

def create_mileage_ledger_sheet(token):
    """Backward compatible wrapper for SHEET_TITLE creation."""
    return create_mileage_sheet(token, SHEET_TITLE)

def create_refuelings_sheet(token):
    """Create the Refuelings sheet with headers."""
    logging.info(f"Creating '{REFUELINGS_TITLE}' sheet in Google Sheets...")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}:batchUpdate"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    add_payload = {
        "requests": [
            {
                "addSheet": {
                    "properties": {
                        "title": REFUELINGS_TITLE,
                        "gridProperties": {
                            "rowCount": 1000,
                            "columnCount": 10
                        }
                    }
                }
            }
        ]
    }
    resp = requests.post(url, headers=headers, json=add_payload, timeout=10)
    if resp.status_code != 200:
        logging.error(f"Failed to add sheet '{REFUELINGS_TITLE}': {resp.text}")
        return None
        
    res_data = resp.json()
    sheet_id = res_data["replies"][0]["addSheet"]["properties"]["sheetId"]
    logging.info(f"Created sheet '{REFUELINGS_TITLE}' with ID: {sheet_id}")
    
    headers_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{REFUELINGS_TITLE}!A1:J1?valueInputOption=RAW"
    header_payload = {
        "values": [[
            "Refuel ID", "Date", "Odometer", "Previous Fuel %", "Current Fuel %", 
            "Gallons Added", "Station Name", "Price per Gallon", "Estimated Cost", "Trip ID"
        ]]
    }
    resp = requests.put(headers_url, headers=headers, json=header_payload, timeout=10)
    if resp.status_code != 200:
        logging.error(f"Failed to write headers to '{REFUELINGS_TITLE}': {resp.text}")
        
    return sheet_id

def get_sqlite_refuelings():
    """Retrieve all refuelings from the SQLite database."""
    if not os.path.exists(DB_PATH):
        logging.warning(f"Database not found at {DB_PATH}")
        return []
        
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM refuelings ORDER BY timestamp ASC")
    rows = cursor.fetchall()
    refuelings = [dict(row) for row in rows]
    conn.close()
    return refuelings

def sync_refuelings(token):
    """Overwrite the Refuelings sheet with current database refuelings."""
    logging.info("Syncing refuelings to 'Refuelings' sheet...")
    
    clear_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{REFUELINGS_TITLE}!A2:J1000:clear"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    resp = requests.post(clear_url, headers=headers, timeout=10)
    if resp.status_code != 200:
        logging.error(f"Failed to clear sheet '{REFUELINGS_TITLE}': {resp.text}")
        return
        
    sqlite_refuelings = get_sqlite_refuelings()
    if not sqlite_refuelings:
        logging.info("No refuelings to write.")
        return
        
    rows = []
    for rf in sqlite_refuelings:
        rows.append([
            str(rf["refueling_id"]),
            rf["timestamp"][:16],
            rf["odometer"],
            round(rf["prev_fuel"], 1),
            round(rf["curr_fuel"], 1),
            round(rf["gallons_added"], 2),
            rf["station_name"] or "Unknown Gas Station",
            round(rf["price_per_gallon"], 3) if rf["price_per_gallon"] else "",
            round(rf["estimated_cost"], 2) if rf["estimated_cost"] else "",
            str(rf["trip_id"]) if rf["trip_id"] else ""
        ])
        
    write_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{REFUELINGS_TITLE}!A2?valueInputOption=USER_ENTERED"
    payload = {"values": rows}
    resp = requests.put(write_url, headers=headers, json=payload, timeout=10)
    if resp.status_code == 200:
        logging.info(f"Successfully populated '{REFUELINGS_TITLE}' sheet with {len(sqlite_refuelings)} rows.")
    else:
        logging.error(f"Failed to populate '{REFUELINGS_TITLE}' sheet: {resp.text}")

async def trigger_quickbooks_sync(trip_id):
    """Call the QuickBooks Online sync endpoint for a specific trip."""
    logging.info(f"Auto-Sync: Triggering QuickBooks Online sync for Trip ID {trip_id}...")
    try:
        # Import the sync service dynamically
        sys.path.append(os.path.dirname(__file__))
        sys.path.append(os.path.join(os.path.dirname(__file__), "../surfaces/automesh"))
        from api.accounting import QuickBooksSyncService
        
        service = QuickBooksSyncService(DB_PATH)
        status, qb_id = await service.sync_trip(trip_id)
        
        logging.info(f"Auto-Sync: Successfully synced Trip {trip_id} to QuickBooks. Ref: {qb_id}")
        return status, qb_id
    except Exception as e:
        logging.error(f"Auto-Sync: Failed to sync trip {trip_id} to QuickBooks: {e}")
        return "Failed", None

def get_sqlite_trips():
    """Retrieve all trips from the SQLite database."""
    if not os.path.exists(DB_PATH):
        logging.warning(f"Database not found at {DB_PATH}")
        return []
        
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trips ORDER BY start_time ASC")
    rows = cursor.fetchall()
    trips = [dict(row) for row in rows]
    conn.close()
    return trips

def get_sheets_trips(token):
    """Retrieve all trip values from Google Sheets."""
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{SHEET_TITLE}!A:M"
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code == 200:
        res_data = resp.json()
        return res_data.get("values", [])
    else:
        logging.error(f"Failed to fetch values from Google Sheets: {resp.text}")
        return []

def append_trips_to_sheets(token, trips_to_append):
    """Append new trips to the Google Sheet."""
    if not trips_to_append:
        return
        
    logging.info(f"Appending {len(trips_to_append)} new trips to Google Sheets...")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{SHEET_TITLE}!A:M:append?valueInputOption=USER_ENTERED"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    rows = []
    for trip in trips_to_append:
        # Map DB category to Sheet category
        cat = "UNASSIGNED"
        if trip["category"] == "BUSINESS":
            cat = "WORK"
        elif trip["category"] == "PERSONAL":
            cat = "PERSONAL"
            
        qb_status = "Pending" if cat == "WORK" else "N/A"
        if trip.get("exported_qb") == 1:
            qb_status = "Synced"
            
        rows.append([
            str(trip["trip_id"]),
            trip["start_time"][:16],
            round(trip["distance_miles"], 1),
            trip["start_odo"],
            trip["end_odo"],
            trip["start_address"] or "",
            trip["end_address"] or "",
            cat,
            trip["notes"] or "",
            qb_status,
            trip["qb_transaction_id"] or "",
            round(trip.get("allocated_fuel_gallons", 0.0), 2),
            round(trip.get("allocated_fuel_cost", 0.0), 2)
        ])
        
    payload = {"values": rows}
    resp = requests.post(url, headers=headers, json=payload, timeout=10)
    if resp.status_code == 200:
        logging.info("Successfully appended trips to Google Sheets.")
    else:
        logging.error(f"Failed to append trips: {resp.text}")

def update_sheets_cells(token, updates):
    """Update specific cells in Google Sheets in a batch operation."""
    if not updates:
        return
        
    logging.info(f"Sending {len(updates)} batch cell updates to Google Sheets...")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values:batchUpdate"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    data = []
    for range_name, value in updates:
        data.append({
            "range": f"{SHEET_TITLE}!{range_name}",
            "values": [[value]]
        })
        
    payload = {
        "valueInputOption": "USER_ENTERED",
        "data": data
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=10)
    if resp.status_code == 200:
        logging.info("Successfully synced updates to Google Sheets.")
    else:
        logging.error(f"Failed to run batch update on Google Sheets: {resp.text}")

def update_sqlite_trip(trip_id, category, notes, exported_qb=None, qb_txn_id=None):
    """Update trip details in the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Map sheets category back to DB
    db_cat = "UNASSIGNED"
    if category == "WORK":
        db_cat = "BUSINESS"
    elif category == "PERSONAL":
        db_cat = "PERSONAL"
        
    # Get current DB trip to check for change
    cursor.execute("SELECT category, notes FROM trips WHERE trip_id = ?", (trip_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
        
    old_cat, old_notes = row
    
    fields = []
    params = []
    
    if db_cat != old_cat:
        fields.append("category = ?")
        params.append(db_cat)
        
    if notes != old_notes and notes is not None:
        fields.append("notes = ?")
        params.append(notes)
        
    if exported_qb is not None:
        fields.append("exported_qb = ?")
        params.append(exported_qb)
        
    if qb_txn_id is not None:
        fields.append("qb_transaction_id = ?")
        params.append(qb_txn_id)
        
    if not fields:
        conn.close()
        return False
        
    params.append(trip_id)
    query = f"UPDATE trips SET {', '.join(fields)} WHERE trip_id = ?"
    cursor.execute(query, params)
    conn.commit()
    conn.close()
    
    logging.info(f"Database: Updated Trip ID {trip_id} | Cat: {db_cat} | Notes: {notes}")
    return True

def sync_filtered_sheet(token, title, filtered_trips):
    """Overwrite the filtered sheet with current matching database trips."""
    logging.info(f"Syncing {len(filtered_trips)} filtered trips to '{title}'...")
    
    # 1. Clear existing rows
    clear_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{title}!A2:M1000:clear"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    resp = requests.post(clear_url, headers=headers, timeout=10)
    if resp.status_code != 200:
        logging.error(f"Failed to clear sheet '{title}': {resp.text}")
        return
        
    if not filtered_trips:
        logging.info(f"No trips to write to '{title}'.")
        return
        
    # 2. Prepare rows
    rows = []
    for trip in filtered_trips:
        cat = "WORK" if trip["category"] == "BUSINESS" else "PERSONAL"
        qb_status = "Pending" if cat == "WORK" else "N/A"
        if trip.get("exported_qb") == 1:
            qb_status = "Synced"
            
        rows.append([
            str(trip["trip_id"]),
            trip["start_time"][:16],
            round(trip["distance_miles"], 1),
            trip["start_odo"],
            trip["end_odo"],
            trip["start_address"] or "",
            trip["end_address"] or "",
            cat,
            trip["notes"] or "",
            qb_status,
            trip["qb_transaction_id"] or "",
            round(trip.get("allocated_fuel_gallons", 0.0), 2),
            round(trip.get("allocated_fuel_cost", 0.0), 2)
        ])
        
    # 3. Write rows
    write_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{title}!A2?valueInputOption=USER_ENTERED"
    payload = {"values": rows}
    resp = requests.put(write_url, headers=headers, json=payload, timeout=10)
    if resp.status_code == 200:
        logging.info(f"Successfully populated '{title}' sheet with {len(filtered_trips)} rows.")
    else:
        logging.error(f"Failed to populate '{title}' sheet: {resp.text}")

async def sync():
    logging.info("Starting Google Sheets Mileage Ledger synchronization...")
    token = load_google_token()
    if not token:
        logging.error("Aborting sync due to lack of Google Workspace authorization.")
        return
        
    # 1. Fetch sheet sheets list to check if Sheet 2 (Mileage Ledger) exists
    meta = get_sheet_metadata(token)
    if not meta:
        logging.error("Aborting sync.")
        return
        
    sheets = meta.get("sheets", [])
    sheet_exists = False
    barnstorm_exists = False
    nfs_exists = False
    refuelings_exists = False
    
    for s in sheets:
        title = s.get("properties", {}).get("title")
        if title == SHEET_TITLE:
            sheet_exists = True
        elif title == BARNSTORM_TITLE:
            barnstorm_exists = True
        elif title == NFS_TITLE:
            nfs_exists = True
        elif title == REFUELINGS_TITLE:
            refuelings_exists = True
            
    if not sheet_exists:
        create_mileage_ledger_sheet(token)
    if not barnstorm_exists:
        create_mileage_sheet(token, BARNSTORM_TITLE)
    if not nfs_exists:
        create_mileage_sheet(token, NFS_TITLE)
    if not refuelings_exists:
        create_refuelings_sheet(token)

    # Ensure all sheet headers are up-to-date with the new columns
    headers_url_template = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{{}}!A1:M1?valueInputOption=USER_ENTERED"
    headers_payload = {
        "values": [[
            "Trip ID", "Date", "Distance (mi)", "Start Odometer", "End Odometer", 
            "Start Location", "End Location", "Category", "Notes", "QB Sync Status", "QB Transaction ID",
            "Fuel Used (gal)", "Fuel Cost ($)"
        ]]
    }
    headers_req = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    for title in [SHEET_TITLE, BARNSTORM_TITLE, NFS_TITLE]:
        requests.put(headers_url_template.format(title), headers=headers_req, json=headers_payload, timeout=10)
        
    # 2. Retrieve trips from SQLite and Google Sheets
    sqlite_trips = get_sqlite_trips()
    sheets_rows = get_sheets_trips(token)
    
    # 3. Parse sheets rows
    # sheets_rows[0] is header. Format:
    # ["Trip ID", "Date", "Distance (mi)", "Start Odometer", "End Odometer", "Start Location", "End Location", "Category", "Notes", "QB Sync Status", "QB Transaction ID"]
    sheets_trips_map = {}
    sheets_header = []
    
    if len(sheets_rows) > 0:
        sheets_header = sheets_rows[0]
        
    for row_idx, row in enumerate(sheets_rows[1:], start=2): # 1-based indexing, start at row 2
        if len(row) < 1:
            continue
        try:
            trip_id = int(row[0].strip())
            sheets_trips_map[trip_id] = {
                "row_num": row_idx,
                "category": row[7] if len(row) > 7 else "UNASSIGNED",
                "notes": row[8] if len(row) > 8 else "",
                "qb_status": row[9] if len(row) > 9 else "",
                "qb_txn_id": row[10] if len(row) > 10 else "",
                "fuel_gal": row[11] if len(row) > 11 else "",
                "fuel_cost": row[12] if len(row) > 12 else ""
            }
        except ValueError:
            # Skip invalid header rows or non-integer Trip IDs
            continue
 
    # 4. Sync from SQLite -> Google Sheets (Appends and status updates)
    trips_to_append = []
    sheets_updates = []
    
    for trip in sqlite_trips:
        trip_id = trip["trip_id"]
        if trip_id not in sheets_trips_map:
            # This trip is not in sheets, prepare for append
            trips_to_append.append(trip)
        else:
            # Trip is in sheets. Check if QuickBooks status has been updated in DB
            sheet_data = sheets_trips_map[trip_id]
            row_num = sheet_data["row_num"]
            
            db_cat = trip["category"]
            sheet_cat = sheet_data["category"]
            
            # Map DB category to Sheet category
            expected_sheet_cat = "UNASSIGNED"
            if db_cat == "BUSINESS":
                expected_sheet_cat = "WORK"
            elif db_cat == "PERSONAL":
                expected_sheet_cat = "PERSONAL"
                
            # If categories are currently out of sync but both are set, let Sheets be the source of truth unless Sheets is UNASSIGNED
            db_notes = trip["notes"] or ""
            sheet_notes = sheet_data["notes"] or ""
            if expected_sheet_cat != sheet_cat:
                if sheet_cat == "UNASSIGNED" and expected_sheet_cat != "UNASSIGNED":
                    # Update Sheets category to match DB
                    sheets_updates.append((f"H{row_num}", expected_sheet_cat))
                    sheet_data["category"] = expected_sheet_cat
            
            # If notes are different, and Sheets has default/empty notes while DB has specific notes, push DB notes to Sheets
            if db_notes != sheet_notes:
                is_sheet_notes_default = sheet_notes == "" or "Automated mileage log" in sheet_notes
                if is_sheet_notes_default and db_notes != "":
                    sheets_updates.append((f"I{row_num}", db_notes))
                    sheet_data["notes"] = db_notes
                    
            # Check QB Sync state
            db_exported = trip.get("exported_qb", 0) == 1
            sheet_qb_status = sheet_data["qb_status"]
            sheet_qb_txn_id = sheet_data["qb_txn_id"]
            
            if db_exported and sheet_qb_status != "Synced":
                sheets_updates.append((f"J{row_num}", "Synced"))
                sheets_updates.append((f"K{row_num}", trip["qb_transaction_id"] or ""))
            elif not db_exported and expected_sheet_cat == "WORK" and sheet_qb_status != "Pending" and sheet_qb_status != "Synced":
                sheets_updates.append((f"J{row_num}", "Pending"))
                
            # Check and sync Fuel columns
            db_fuel_gal = round(trip.get("allocated_fuel_gallons", 0.0), 2)
            db_fuel_cost = round(trip.get("allocated_fuel_cost", 0.0), 2)
            sheet_fuel_gal = sheet_data.get("fuel_gal", "")
            sheet_fuel_cost = sheet_data.get("fuel_cost", "")
            
            try:
                s_gal = float(sheet_fuel_gal) if sheet_fuel_gal else 0.0
            except ValueError:
                s_gal = -1.0
            try:
                s_cost = float(sheet_fuel_cost) if sheet_fuel_cost else 0.0
            except ValueError:
                s_cost = -1.0
                
            if abs(s_gal - db_fuel_gal) > 0.01 or sheet_fuel_gal == "":
                sheets_updates.append((f"L{row_num}", str(db_fuel_gal)))
            if abs(s_cost - db_fuel_cost) > 0.01 or sheet_fuel_cost == "":
                sheets_updates.append((f"M{row_num}", str(db_fuel_cost)))
 
    # Perform appends and cell updates to Sheets
    if trips_to_append:
        append_trips_to_sheets(token, trips_to_append)
        
    if sheets_updates:
        update_sheets_cells(token, sheets_updates)
        
    # Re-fetch Google Sheets trips if we appended to get correct row indices for updates
    if trips_to_append:
        sheets_rows = get_sheets_trips(token)
        sheets_trips_map = {}
        for row_idx, row in enumerate(sheets_rows[1:], start=2):
            if len(row) < 1:
                continue
            try:
                trip_id = int(row[0].strip())
                sheets_trips_map[trip_id] = {
                    "row_num": row_idx,
                    "category": row[7] if len(row) > 7 else "UNASSIGNED",
                    "notes": row[8] if len(row) > 8 else "",
                    "qb_status": row[9] if len(row) > 9 else "",
                    "qb_txn_id": row[10] if len(row) > 10 else ""
                }
            except ValueError:
                continue
 
    # 5. Sync from Google Sheets -> SQLite (User updates and automated QB syncs)
    sheets_to_db_updates = []
    
    for trip in sqlite_trips:
        trip_id = trip["trip_id"]
        if trip_id in sheets_trips_map:
            sheet_data = sheets_trips_map[trip_id]
            row_num = sheet_data["row_num"]
            
            sheet_cat = sheet_data["category"]
            sheet_notes = sheet_data["notes"]
            
            db_cat = trip["category"]
            # Map DB category to expected Sheet category
            expected_sheet_cat = "UNASSIGNED"
            if db_cat == "BUSINESS":
                expected_sheet_cat = "WORK"
            elif db_cat == "PERSONAL":
                expected_sheet_cat = "PERSONAL"
                
            db_notes = trip["notes"] or ""
            
            cat_changed = sheet_cat != expected_sheet_cat
            notes_changed = sheet_notes != db_notes
            
            if cat_changed or notes_changed:
                logging.info(f"Detected change in Google Sheets for Trip ID {trip_id}: Cat: '{expected_sheet_cat}' -> '{sheet_cat}' | Notes: '{db_notes}' -> '{sheet_notes}'")
                
                # Update SQLite database
                db_mapped_cat = "UNASSIGNED"
                if sheet_cat == "WORK":
                    db_mapped_cat = "BUSINESS"
                elif sheet_cat == "PERSONAL":
                    db_mapped_cat = "PERSONAL"
                    
                update_sqlite_trip(trip_id, sheet_cat, sheet_notes)
                
                # If newly marked as WORK/BUSINESS and not yet exported to QB, trigger QBO sync!
                if sheet_cat == "WORK" and trip.get("exported_qb", 0) == 0:
                    qb_status, qb_txn_id = await trigger_quickbooks_sync(trip_id)
                    if qb_status:
                        # Write the sync status back to Sheets instantly
                        update_sheets_cells(token, [
                            (f"J{row_num}", qb_status),
                            (f"K{row_num}", qb_txn_id or "")
                        ])
                        
    # 6. Filter and update client-specific sheets (Barnstorm and North Fork Sun)
    fresh_trips = get_sqlite_trips()
    
    barnstorm_trips = []
    nfs_trips = []
    
    for trip in fresh_trips:
        notes_lower = (trip["notes"] or "").lower()
        start_lower = (trip["start_address"] or "").lower()
        end_lower = (trip["end_address"] or "").lower()
        
        is_bs = (
            "barnstorm" in notes_lower or 
            "cameron" in notes_lower or 
            "barnstorm" in start_lower or 
            "barnstorm" in end_lower
        )
        is_nfs = (
            "north fork sun" in notes_lower or 
            "jaymee" in notes_lower or 
            "north fork sun" in start_lower or 
            "north fork sun" in end_lower
        )
        
        if trip["category"] == "BUSINESS":
            if is_bs:
                barnstorm_trips.append(trip)
            if is_nfs:
                nfs_trips.append(trip)
                
    sync_filtered_sheet(token, BARNSTORM_TITLE, barnstorm_trips)
    sync_filtered_sheet(token, NFS_TITLE, nfs_trips)
    
    sync_refuelings(token)
    
    # Auto-resize columns to prevent date and header clipping
    auto_resize_columns(token)
    
    logging.info("Google Sheets Mileage Ledger synchronization complete.")

def auto_resize_columns(token):
    logging.info("Google Sheets API: Auto-resizing columns to prevent clipping...")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}:batchUpdate"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    meta = get_sheet_metadata(token)
    if not meta:
        return
        
    requests_list = []
    for s in meta.get("sheets", []):
        sheet_id = s.get("properties", {}).get("sheetId")
        requests_list.append({
            "autoResizeDimensions": {
                "dimensions": {
                    "sheetId": sheet_id,
                    "dimension": "COLUMNS",
                    "startIndex": 0,
                    "endIndex": 13
                }
            }
        })
        
    payload = {"requests": requests_list}
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=15)
        if resp.status_code == 200:
            logging.info("Google Sheets API: Auto-resize completed successfully!")
        else:
            logging.error(f"Google Sheets API: Auto-resize failed: {resp.text}")
    except Exception as e:
        logging.error(f"Google Sheets API: Auto-resize exception: {e}")
 
if __name__ == "__main__":
    import asyncio
    asyncio.run(sync())
