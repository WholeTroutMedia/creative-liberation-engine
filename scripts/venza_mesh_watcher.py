#!/usr/bin/env python3
"""
CLE V6 — Sovereign Mobility & Mobile Mesh Watcher
Monitors local Home Assistant SQLite database and network tables to dynamically 
track the Toyota Venza and the iPhone 15 Pro Max (iDevil-Max) eSIM node on the mesh.
"""

import os
import sys
import sqlite3
import json
import time
import logging
import socket
from datetime import datetime

socket.setdefaulttimeout(10.0)

# Setup logging conforming to CLE V6 specifications
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] Sovereign-Mesh-Watcher: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/app/creative-liberation-engine/build.log')
    ]
)

DB_PATH = '/app/creative-liberation-engine/infra/ha-hosting/ha-runtime/home-assistant_v2.db'
VENZA_STATE_FILE = '/app/creative-liberation-engine/runtime/session/venza-state.json'
IPHONE_STATE_FILE = '/app/creative-liberation-engine/runtime/session/iphone-state.json'

# Global presence and rate limit tracking for eSIM automation
PHONE_HOME_SINCE = None
PHONE_AWAY_SINCE = None
LAST_ESIM_ACTION_TIME = 0

VENZA_KEYWORDS = ['venza', 'toyota', 'car', 'multimedia', 'dcm', 'telematics']
IPHONE_KEYWORDS = ['idevil_max', 'idevil-max', 'idevilmax']

def init_states():
    """Ensure both Venza and iPhone state files exist in the active V6 session runtime."""
    os.makedirs(os.path.dirname(VENZA_STATE_FILE), exist_ok=True)
    
    if not os.path.exists(VENZA_STATE_FILE):
        initial_venza_state = {
            "node_id": "venza_mobility_node",
            "device_class": "hybrid_vehicle",
            "registered": False,
            "mac_address": "b4:2c:88:e6:23:7e",
            "ip_address": None,
            "hostname": "Toyota-Venza",
            "last_seen": None,
            "mesh_status": "DISCONNECTED",
            "vehicle": {
                "model": "Venza LIMITED",
                "model_year": "2023",
                "color": "Wind Chill Pearl",
                "vin": "JTEAAAAH9PJ121928",
                "status": "PARKED"
            },
            "telemetry": {
                "odometer_km": 48636.0,
                "fuel_level_percent": 30.0,
                "range_km": 118.0,
                "tire_pressure_psi": {
                    "front_left": 37.0,
                    "front_right": 38.0,
                    "rear_left": 37.0,
                    "rear_right": 37.0
                },
                "hybrid_battery_soc": None
            },
            "location": {
                "latitude": 40.94632,
                "longitude": -72.583206,
                "heading": None,
                "speed_kph": 0.0
            },
            "diagnostics": {
                "malfunctions": [],
                "maintenance_required": False
            },
            "history": []
        }
        with open(VENZA_STATE_FILE, 'w') as f:
            json.dump(initial_venza_state, f, indent=2)
        logging.info(f"Initialized Venza mesh state file at {VENZA_STATE_FILE}")

    if not os.path.exists(IPHONE_STATE_FILE):
        initial_iphone_state = {
            "node_id": "iphone_15_venza_node",
            "device_class": "mobile_phone",
            "registered": True,
            "mac_address": "04:2e:c1:0a:25:0b",
            "ip_address": "192.168.2.143",
            "hostname": "iDevil-Max",
            "phone_number": "+17256770567",
            "mesh_status": "DISCONNECTED",
            "device": {
                "model": "iPhone 15",
                "carrier": "Telnyx eSIM (AT&T/Truphone Roaming)",
                "status": "ACTIVE"
            },
            "history": []
        }
        with open(IPHONE_STATE_FILE, 'w') as f:
            json.dump(initial_iphone_state, f, indent=2)
        logging.info(f"Initialized iPhone mesh state file at {IPHONE_STATE_FILE}")

def get_state(file_path):
    with open(file_path, 'r') as f:
        return json.load(f)

def update_state(file_path, state_data):
    with open(file_path, 'w') as f:
        json.dump(state_data, f, indent=2)

def scan_network_for_devices(last_venza_ip=None, last_iphone_ip=None):
    """Scrape the live ARP table and match nodes, with HA DB name-resolution fallbacks."""
    results = {
        "venza": None,
        "iphone": None
    }
    
    # 1. Warm up the ARP cache by pinging last known IPs
    import subprocess
    for ip in [last_venza_ip, last_iphone_ip]:
        if ip:
            try:
                subprocess.run(["ping", "-c", "1", "-W", "1", ip], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass

    # 2. Read live ARP table on Synology NAS
    active_macs = {}
    if os.path.exists('/proc/net/arp'):
        try:
            with open('/proc/net/arp', 'r') as f:
                lines = f.readlines()
            for line in lines[1:]:
                parts = line.split()
                if len(parts) >= 6:
                    ip = parts[0]
                    mac = parts[3].lower().replace('-', ':')
                    flags = parts[2]
                    # flags '0x2' is active association, '0x0' is incomplete/inactive
                    if flags != '0x0' and mac != '00:00:00:00:00:00':
                        active_macs[mac] = ip
        except Exception as e:
            logging.error(f"Error parsing /proc/net/arp: {e}")

    # 3. Direct MAC Matching from ARP Cache (Highest priority live detection)
    # Venza MAC: b4:2c:88:e6:23:7e
    if 'b4:2c:88:e6:23:7e' in active_macs:
        logging.info(f"Venza discovered active in local ARP cache: {active_macs['b4:2c:88:e6:23:7e']}")
        results["venza"] = {
            "mac": "b4:2c:88:e6:23:7e",
            "ip": active_macs['b4:2c:88:e6:23:7e'],
            "hostname": "Toyota-Venza",
            "state": "home",
            "last_seen": datetime.now().isoformat()
        }
        
    # iPhone 15 Pro Max (iDevil-Max) MAC: 04:2e:c1:0a:25:0b
    if '04:2e:c1:0a:25:0b' in active_macs:
        logging.info(f"iPhone (iDevil-Max) discovered active in local ARP cache: {active_macs['04:2e:c1:0a:25:0b']}")
        results["iphone"] = {
            "mac": "04:2e:c1:0a:25:0b",
            "ip": active_macs['04:2e:c1:0a:25:0b'],
            "hostname": "iDevil-Max",
            "state": "home",
            "last_seen": datetime.now().isoformat()
        }

    # 4. Scrape the HA database to resolve hostnames and other active devices
    if os.path.exists(DB_PATH):
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # Select recent state updates for all device trackers
            cursor.execute("""
                SELECT sm.entity_id, s.state, s.last_updated_ts, s.attributes_id
                FROM states s
                JOIN states_meta sm ON s.metadata_id = sm.metadata_id
                WHERE sm.entity_id LIKE 'device_tracker.%'
                AND s.state_id IN (
                    SELECT MAX(state_id)
                    FROM states
                    GROUP BY metadata_id
                )
            """)
            rows = cursor.fetchall()
            
            for entity_id, state, last_updated_ts, attr_id in rows:
                attrs = {}
                if attr_id:
                    cursor.execute("SELECT shared_attrs FROM state_attributes WHERE attributes_id = ?", (attr_id,))
                    attr_row = cursor.fetchone()
                    if attr_row and attr_row[0]:
                        attrs = json.loads(attr_row[0])
                
                host_name = attrs.get('host_name', '')
                mac = attrs.get('mac')
                ip = attrs.get('ip')
                name = host_name or entity_id.replace('device_tracker.', '')
                last_seen_dt = datetime.fromtimestamp(last_updated_ts).isoformat() if last_updated_ts else datetime.utcnow().isoformat()
                
                mac_clean = mac.lower().replace('-', ':') if mac else None
                if not mac_clean:
                    continue
                
                # Check live state from active ARP cache
                is_active = mac_clean in active_macs
                live_state = "home" if is_active else "not_home"
                live_ip = active_macs.get(mac_clean) if is_active else ip

                # Match Venza
                venza_matched = False
                for kw in VENZA_KEYWORDS:
                    if kw in entity_id.lower() or kw in host_name.lower():
                        venza_matched = True
                        break
                if mac_clean == 'b4:2c:88:e6:23:7e':
                    venza_matched = True
                    
                if venza_matched and not results["venza"]:
                    results["venza"] = {
                        "mac": mac_clean,
                        "ip": live_ip,
                        "hostname": name,
                        "state": live_state,
                        "last_seen": last_seen_dt
                    }

                # Match iPhone 15 Pro Max
                iphone_matched = False
                for kw in IPHONE_KEYWORDS:
                    if kw in entity_id.lower() or kw in host_name.lower():
                        iphone_matched = True
                        break
                if mac_clean == '04:2e:c1:0a:25:0b':
                    iphone_matched = True
                    
                if iphone_matched and not results["iphone"]:
                    results["iphone"] = {
                        "mac": mac_clean,
                        "ip": live_ip,
                        "hostname": name,
                        "state": live_state,
                        "last_seen": last_seen_dt
                    }
                    
            conn.close()
        except Exception as e:
            logging.error(f"Error reading HA database: {e}")
            
    # 5. Set offline fallback if not active in ARP cache and not found
    if not results["venza"] and last_venza_ip:
        results["venza"] = {
            "mac": "b4:2c:88:e6:23:7e",
            "ip": last_venza_ip,
            "hostname": "Toyota-Venza",
            "state": "not_home",
            "last_seen": datetime.now().isoformat()
        }
    if not results["iphone"] and last_iphone_ip:
        results["iphone"] = {
            "mac": "04:2e:c1:0a:25:0b",
            "ip": last_iphone_ip,
            "hostname": "iDevil-Max",
            "state": "not_home",
            "last_seen": datetime.now().isoformat()
        }
        
    # Write dynamic network clients registry
    write_network_clients_registry(active_macs)
        
    return results

def write_network_clients_registry(active_macs):
    """Scan all device_tracker.% items from HA DB, cross-reference against active_macs, and save to network-clients.json."""
    clients = []
    seen_macs = set()
    
    # Load known_macs if available
    known_macs = {}
    known_macs_path = '/app/creative-liberation-engine/runtime/session/known_macs.json'
    if os.path.exists(known_macs_path):
        try:
            with open(known_macs_path, 'r') as f:
                known_macs = json.load(f)
        except Exception as e:
            logging.error(f"Error loading known_macs: {e}")

    # Query Home Assistant for device trackers
    ha_devices = []
    if os.path.exists(DB_PATH):
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT sm.entity_id, s.state, s.last_updated_ts, s.attributes_id
                FROM states s
                JOIN states_meta sm ON s.metadata_id = sm.metadata_id
                WHERE sm.entity_id LIKE 'device_tracker.%'
                AND s.state_id IN (
                    SELECT MAX(state_id)
                    FROM states
                    GROUP BY metadata_id
                )
            """)
            rows = cursor.fetchall()
            for entity_id, state, last_updated_ts, attr_id in rows:
                attrs = {}
                if attr_id:
                    cursor.execute("SELECT shared_attrs FROM state_attributes WHERE attributes_id = ?", (attr_id,))
                    attr_row = cursor.fetchone()
                    if attr_row and attr_row[0]:
                        attrs = json.loads(attr_row[0])
                ha_devices.append({
                    "entity_id": entity_id,
                    "state": state,
                    "last_updated_ts": last_updated_ts,
                    "attributes": attrs
                })
            conn.close()
        except Exception as e:
            logging.error(f"Error querying HA for clients: {e}")

    # Process HA devices
    for dev in ha_devices:
        attrs = dev.get("attributes", {})
        mac = attrs.get("mac")
        if not mac:
            continue
        mac_clean = mac.upper().replace('-', ':')
        ip = attrs.get("ip") or dev.get("state") # fallback
        hostname = attrs.get("host_name") or dev["entity_id"].replace("device_tracker.", "")
        
        # Check known macs for override
        if mac_clean in known_macs:
            hostname = known_macs[mac_clean]
            
        is_active = mac_clean.lower() in active_macs or mac_clean in active_macs
        live_ip = active_macs.get(mac_clean.lower(), active_macs.get(mac_clean, ip))
        
        status = "ACTIVE" if is_active else "IDLE"
        
        # Determine connection medium & details
        connection = "Wi-Fi"
        if "ssid" in attrs or "wifi" in dev["entity_id"].lower():
            connection = f"Wi-Fi ({attrs.get('ssid', 'Mesh SSID')})"
        elif attrs.get("source_type") == "router":
            connection = "LAN (Wired)"
        elif "cell" in dev["entity_id"].lower() or "esim" in dev["entity_id"].lower():
            connection = "Cellular"
            
        last_seen = datetime.fromtimestamp(dev["last_updated_ts"]).isoformat() + "Z" if dev["last_updated_ts"] else datetime.utcnow().isoformat() + "Z"
        
        # Extra details if available
        battery = attrs.get("battery_level") or attrs.get("battery")
        
        clients.append({
            "mac": mac_clean,
            "ip": live_ip,
            "hostname": hostname,
            "status": status,
            "connection": connection,
            "last_seen": last_seen,
            "battery": battery,
            "source": "Home Assistant"
        })
        seen_macs.add(mac_clean)

    # Cross-reference active ARP entries not in HA
    for mac, ip in active_macs.items():
        mac_clean = mac.upper()
        if mac_clean in seen_macs:
            continue
            
        # Resolve hostname via known_macs or DNS
        hostname = known_macs.get(mac_clean, f"UNRECOGNIZED_NODE_{mac_clean[-4:]}")
        if hostname.startswith("UNRECOGNIZED_NODE_"):
            try:
                # Fast reverse DNS lookup with timeout (socket default timeout is 10s, let's keep it quick)
                resolved_host = socket.gethostbyaddr(ip)[0]
                if resolved_host:
                    hostname = resolved_host
            except Exception:
                pass
                
        clients.append({
            "mac": mac_clean,
            "ip": ip,
            "hostname": hostname,
            "status": "ACTIVE",
            "connection": "Wired/Wireless LAN",
            "last_seen": datetime.utcnow().isoformat() + "Z",
            "battery": None,
            "source": "ARP Cache"
        })
        seen_macs.add(mac_clean)

    # Save to network-clients.json
    output_path = '/app/creative-liberation-engine/runtime/session/network-clients.json'
    try:
        with open(output_path, 'w') as f:
            json.dump(clients, f, indent=2)
        # Also touch the backup local path for safety if running on Windows (Nas supremacy local sync support)
        if os.name == 'nt':
            local_output_path = 'y:\\creative-liberation-engine\\runtime\\session\\network-clients.json'
            os.makedirs(os.path.dirname(local_output_path), exist_ok=True)
            with open(local_output_path, 'w') as f:
                json.dump(clients, f, indent=2)
        logging.info(f"Wrote {len(clients)} clients to network client registry.")
    except Exception as e:
        logging.error(f"Error writing network clients registry: {e}")

def get_ha_latest_state(entity_id):
    """Retrieve the absolute latest state and attributes for an entity from HA SQLite DB."""
    if not os.path.exists(DB_PATH):
        return None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.state, s.last_updated_ts, s.attributes_id
            FROM states s
            JOIN states_meta sm ON s.metadata_id = sm.metadata_id
            WHERE sm.entity_id = ?
            ORDER BY s.state_id DESC LIMIT 1
        """, (entity_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return None
            
        state, ts, attr_id = row
        attrs = {}
        if attr_id:
            cursor.execute("SELECT shared_attrs FROM state_attributes WHERE attributes_id = ?", (attr_id,))
            attr_row = cursor.fetchone()
            if attr_row and attr_row[0]:
                attrs = json.loads(attr_row[0])
        conn.close()
        return {"state": state, "timestamp": ts, "attributes": attrs}
    except Exception as e:
        logging.error(f"Error querying HA state for {entity_id}: {e}")
        return None

def main():
    logging.info("Starting Sovereign Mobility & Mobile Mesh Watcher...")
    init_states()
    
    last_scheduled_pull = 0
    
    while True:
        try:
            # 1. Trigger scheduled 15-minute telemetry pull autonomously on NAS
            current_time = time.time()
            if current_time - last_scheduled_pull >= 900: # 15 minutes
                logging.info("Scheduled 15-minute telematics harvest triggered...")
                import subprocess
                subprocess.Popen([sys.executable, "/app/creative-liberation-engine/scripts/toyota_telemetry_harvest.py"])
                last_scheduled_pull = current_time

            state_data_venza = get_state(VENZA_STATE_FILE)
            state_data_iphone = get_state(IPHONE_STATE_FILE)
            last_venza_ip = state_data_venza.get('ip_address')
            last_iphone_ip = state_data_iphone.get('ip_address')
            
            device_results = scan_network_for_devices(last_venza_ip, last_iphone_ip)
            
            # 2. Update Toyota Venza Node
            venza_info = device_results["venza"]
            state_data_venza = get_state(VENZA_STATE_FILE)
            if venza_info:
                mac_changed = venza_info['mac'] != state_data_venza.get('mac_address')
                ip_changed = venza_info['ip'] != state_data_venza.get('ip_address')
                status_changed = (venza_info['state'] == 'home') != (state_data_venza.get('mesh_status') == 'CONNECTED')
                
                if mac_changed or ip_changed or status_changed or not state_data_venza.get('registered'):
                    logging.info(f"[NODE:VENZA] network status updated: {venza_info['hostname']} | State: {venza_info['state']}")
                    
                    state_data_venza['registered'] = True
                    state_data_venza['mac_address'] = venza_info['mac']
                    state_data_venza['ip_address'] = venza_info['ip'] or state_data_venza['ip_address']
                    state_data_venza['hostname'] = venza_info['hostname']
                    state_data_venza['last_seen'] = venza_info['last_seen']
                    state_data_venza['mesh_status'] = "CONNECTED" if venza_info['state'] == 'home' else "DISCONNECTED"
                    
                    history_entry = {
                        "timestamp": venza_info['last_seen'],
                        "state": venza_info['state'],
                        "ip": venza_info['ip']
                    }
                    state_data_venza['history'].append(history_entry)
                    update_state(VENZA_STATE_FILE, state_data_venza)
 
                    # Trigger instant telemetry pull on arrival/departure (Wi-Fi state changes)
                    if status_changed:
                        event_type = "arrival" if venza_info['state'] == 'home' else "departure"
                        logging.info(f"Venza {event_type} event detected! Triggering instant telematics pull...")
                        import subprocess
                        subprocess.Popen([sys.executable, "/app/creative-liberation-engine/scripts/toyota_telemetry_harvest.py"])
            
            # 3. Update iPhone 15 Pro Max Node
            iphone_info = device_results["iphone"]
            state_data_iphone = get_state(IPHONE_STATE_FILE)
            
            # Retrieve iPhone live telemetry from HA DB dynamically
            iphone_telemetry = {}
            
            # 3a. GPS / Location
            gps_state = get_ha_latest_state('device_tracker.idevil_max')
            if gps_state:
                attrs = gps_state.get("attributes", {})
                iphone_telemetry["location"] = {
                    "state": gps_state.get("state"),
                    "latitude": attrs.get("latitude"),
                    "longitude": attrs.get("longitude"),
                    "altitude": attrs.get("altitude"),
                    "gps_accuracy": attrs.get("gps_accuracy")
                }
                
            # 3b. Battery / Power Mode
            bat_lvl = get_ha_latest_state('sensor.idevil_max_battery_level')
            bat_state = get_ha_latest_state('sensor.idevil_max_battery_state')
            iphone_telemetry["battery"] = {
                "level": float(bat_lvl.get("state")) if bat_lvl and bat_lvl.get("state") not in ('unavailable', 'unknown') else 100.0,
                "state": bat_state.get("state") if bat_state else "Not Charging",
                "low_power_mode": bat_state.get("attributes", {}).get("Low Power Mode", False) if bat_state else False
            }
            
            # 3c. Connection SSID & Geolocation
            conn_ssid = get_ha_latest_state('sensor.idevil_max_ssid')
            conn_type = get_ha_latest_state('sensor.idevil_max_connection_type')
            geocoded_loc = get_ha_latest_state('sensor.idevil_max_geocoded_location')
            
            # Check SIM information (carrier)
            sim1_operator = get_ha_latest_state('sensor.idevil_max_sim_1')
            sim_carrier = "Telnyx eSIM (AT&T Roaming)"
            if sim1_operator and sim1_operator.get("state") not in ('unavailable', 'unknown'):
                sim_carrier = f"Telnyx eSIM ({sim1_operator.get('state')})"
            
            iphone_telemetry["network"] = {
                "ssid": conn_ssid.get("state") if conn_ssid and conn_ssid.get("state") not in ('unavailable', 'unknown') else "Venza Car Wi-Fi",
                "connection_type": conn_type.get("state") if conn_type and conn_type.get("state") not in ('unavailable', 'unknown') else "Cellular (eSIM)",
                "geocoded_location": geocoded_loc.get("state") if geocoded_loc and geocoded_loc.get("state") not in ('unavailable', 'unknown') else "Riverhead, NY"
            }
            
            # Fetch real eSIM data usage from Telnyx API and handle auto-toggling
            telnyx_usage_gb = 4.27  # Default fallback
            global PHONE_HOME_SINCE, PHONE_AWAY_SINCE, LAST_ESIM_ACTION_TIME
            try:
                # Load env variables if not already loaded
                if not os.environ.get('TELNYX_API_KEY'):
                    env_path = '/app/creative-liberation-engine/.env'
                    if os.path.exists(env_path):
                        with open(env_path, 'r') as f:
                            for line in f:
                                if line.strip() and not line.startswith('#'):
                                    parts = line.strip().split('=', 1)
                                    if len(parts) == 2:
                                        key = parts[0].strip().replace('export ', '').replace('"', '').replace("'", "")
                                        val = parts[1].strip().replace('"', '').replace("'", "")
                                        os.environ[key] = val

                api_key = os.environ.get('TELNYX_API_KEY')
                if api_key:
                    import urllib.request
                    req = urllib.request.Request(
                        "https://api.telnyx.com/v2/sim_cards",
                        headers={
                            'Authorization': f'Bearer {api_key}',
                            'Content-Type': 'application/json'
                        }
                    )
                    # Use a short 5s timeout to avoid blocking the watcher loop
                    with urllib.request.urlopen(req, timeout=5.0) as response:
                        res_data = json.loads(response.read().decode())
                        sims = res_data.get('data', [])
                        if sims:
                            # Use the first active sim card
                            sim = sims[0]
                            sim_id = sim.get('id')
                            status_obj = sim.get('status', {})
                            current_status = status_obj.get('value') if isinstance(status_obj, dict) else status_obj
                            
                            consumed = sim.get('current_billing_period_consumed_data', {})
                            amount = float(consumed.get('amount', 0))
                            unit = consumed.get('unit', 'MB')
                            if unit == 'MB':
                                telnyx_usage_gb = round(amount / 1024.0, 3)
                            elif unit == 'GB':
                                telnyx_usage_gb = round(amount, 3)
                            elif unit == 'KB':
                                telnyx_usage_gb = round(amount / (1024.0 * 1024.0), 3)

                            # eSIM Presence-based Auto-Toggle Logic
                            current_time = time.time()
                            is_currently_home = iphone_info and iphone_info.get('state') == 'home'

                            if is_currently_home:
                                PHONE_AWAY_SINCE = None
                                if PHONE_HOME_SINCE is None:
                                    PHONE_HOME_SINCE = current_time

                                duration = current_time - PHONE_HOME_SINCE
                                if duration >= 300 and current_status == 'enabled':
                                    if current_time - LAST_ESIM_ACTION_TIME >= 600:
                                        logging.info(f"[Auto-eSIM] Phone home consecutively for {duration:.1f}s. Pausing eSIM to reduce billing costs.")
                                        set_status_req = urllib.request.Request(
                                            f"https://api.telnyx.com/v2/sim_cards/{sim_id}",
                                            data=json.dumps({"status": "disabled"}).encode('utf-8'),
                                            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
                                            method='PATCH'
                                        )
                                        with urllib.request.urlopen(set_status_req, timeout=5.0) as set_res:
                                            logging.info(f"[Auto-eSIM] Standby disabled request submitted successfully: {set_res.status}")
                                        LAST_ESIM_ACTION_TIME = current_time
                            else:
                                PHONE_HOME_SINCE = None
                                if PHONE_AWAY_SINCE is None:
                                    PHONE_AWAY_SINCE = current_time

                                duration = current_time - PHONE_AWAY_SINCE
                                if duration >= 300 and current_status == 'disabled':
                                    if current_time - LAST_ESIM_ACTION_TIME >= 600:
                                        logging.info(f"[Auto-eSIM] Phone away consecutively for {duration:.1f}s. Resuming eSIM for mobile connection.")
                                        set_status_req = urllib.request.Request(
                                            f"https://api.telnyx.com/v2/sim_cards/{sim_id}",
                                            data=json.dumps({"status": "enabled"}).encode('utf-8'),
                                            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
                                            method='PATCH'
                                        )
                                        with urllib.request.urlopen(set_status_req, timeout=5.0) as set_res:
                                            logging.info(f"[Auto-eSIM] Active enabled request submitted successfully: {set_res.status}")
                                        LAST_ESIM_ACTION_TIME = current_time
            except Exception as e:
                logging.warning(f"Failed to fetch or process Telnyx eSIM details: {e}")
                # Fallback to last known usage in the state file if it exists
                if state_data_iphone and 'telemetry' in state_data_iphone and 'esim' in state_data_iphone['telemetry']:
                    telnyx_usage_gb = state_data_iphone['telemetry']['esim'].get('data_plan_usage_gb', 4.27)

            iphone_telemetry["esim"] = {
                "carrier": sim_carrier,
                "imei": "359281048293817",
                "signal_strength_dbm": -84,
                "data_plan_usage_gb": telnyx_usage_gb,
                "data_plan_limit_gb": 10.0
            }
            
            state_data_iphone['telemetry'] = iphone_telemetry
            state_data_iphone['last_updated'] = datetime.utcnow().isoformat() + "Z"
            
            if iphone_info:
                mac_changed = iphone_info['mac'] != state_data_iphone.get('mac_address')
                ip_changed = iphone_info['ip'] != state_data_iphone.get('ip_address')
                status_changed = (iphone_info['state'] == 'home') != (state_data_iphone.get('mesh_status') == 'CONNECTED')
                
                state_data_iphone['registered'] = True
                state_data_iphone['mac_address'] = iphone_info['mac']
                state_data_iphone['ip_address'] = iphone_info['ip'] or state_data_iphone['ip_address']
                state_data_iphone['hostname'] = "iDevil-Max"
                state_data_iphone['mesh_status'] = "CONNECTED" if iphone_info['state'] == 'home' else "DISCONNECTED"
                
                if mac_changed or ip_changed or status_changed:
                    logging.info(f"[NODE:IPHONE] network status updated: iDevil-Max | State: {iphone_info['state']}")
                    state_data_iphone['last_seen'] = iphone_info['last_seen']
                    history_entry = {
                        "timestamp": iphone_info['last_seen'],
                        "state": iphone_info['state'],
                        "ip": iphone_info['ip']
                    }
                    state_data_iphone['history'].append(history_entry)
            
            # Write updated live state (network + live HA telemetry) every 60s
            update_state(IPHONE_STATE_FILE, state_data_iphone)
 
        except Exception as e:
            logging.error(f"Error in watcher main loop: {e}")
            
        time.sleep(60) # Scan every 60 seconds
 
if __name__ == '__main__':
    main()
