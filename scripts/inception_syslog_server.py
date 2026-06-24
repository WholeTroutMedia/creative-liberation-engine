#!/usr/bin/env python3
"""
CLE V6 — Sovereign Syslog Mesh Daemon
Binds to port 514 (UDP) to ingest real-time router events, WPA handshakes, 
DHCP requests, and disconnections directly into the CLE Memory Spine.
"""

import os
import sys
import socket
import json
import re
import threading
import logging
from datetime import datetime

# Setup paths
LOG_DIR = '/app/creative-liberation-engine/runtime/ingestion'
LOG_FILE = os.path.join(LOG_DIR, 'syslog.log')
STATE_FILE = '/app/creative-liberation-engine/runtime/session/venza-state.json'
ANOMALY_FILE = os.path.join(LOG_DIR, 'network_anomalies.jsonl')
KNOWN_DEVICES_FILE = '/app/creative-liberation-engine/runtime/session/known_macs.json'

# Setup logging for the daemon itself
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] Syslog-Mesh: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/app/creative-liberation-engine/build.log')
    ]
)

os.makedirs(LOG_DIR, exist_ok=True)

# Keyword patterns for WPA/DHCP events
# Example: "DHCP NOTICE DHCPD: Recv REQUEST from AA:BB:CC:DD:EE:FF"
# Example: "WPA INFO wireless: Ath0 auth AA:BB:CC:DD:EE:FF successfully"
MAC_PATTERN = re.compile(r'([0-9a-fA-F]{2}[: -][0-9a-fA-F]{2}[: -][0-9a-fA-F]{2}[: -][0-9a-fA-F]{2}[: -][0-9a-fA-F]{2}[: -][0-9a-fA-F]{2})')
IP_PATTERN = re.compile(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})')

def init_known_devices():
    """Seed the known MAC address registry with your currently connected home nodes."""
    if not os.path.exists(KNOWN_DEVICES_FILE):
        # Initial seeding with known MACs extracted from the active client list
        known = {
            "AC:A7:F1:5F:E4:4D": "OFFICE",
            "00:11:32:B9:4F:00": "WHOLETROUTMEDIA_NAS_1",
            "00:11:32:B9:4F:01": "WholeTroutMedia_NAS_2",
            "C4:29:96:BA:0D-85": "C42996CA0D85",
            "B4:61:E9:71:FF:17": "TP-LINK_DEFAULT",
            "B0:81:84:8F:A9:42": "espressif_Pond_Sentinel",
            "34:EE:16:97:22:75": "iDevil-Pro-2",
            "FE:49:CF:09:09:C2": "Optimum-Stream-5598",
            "94:9F:3E:08:94:C0": "SonosZP_Living",
            "80:B5:4E:96:DB:AC": "ST251121074_TV_BOX",
            "EA:51:D8:03:7D:CD": "iPad",
            "04:2E:C1:0A:25:0B": "iDevil-Max",
            "B8:E9:37:B6:7B:36": "SonosZP_Office",
            "DC:03:98:5E:E6:86": "LGwebOSTV",
            "B8:2C:A0:47:DE:80": "Tstat_Thermostat",
            "94:9F:3E:14:D2:62": "SonosZP_Kitchen",
            "8E:49:DC:02:78:4B": "iPhone_Randomized",
            "82:39:82:FE:33:29": "iPhone_Primary"
        }
        with open(KNOWN_DEVICES_FILE, 'w') as f:
            json.dump(known, f, indent=2)
        logging.info(f"Initialized known MAC registry at {KNOWN_DEVICES_FILE}")

def get_known_devices():
    init_known_devices()
    with open(KNOWN_DEVICES_FILE, 'r') as f:
        return json.load(f)

def add_known_device(mac, name):
    known = get_known_devices()
    known[mac.upper()] = name
    with open(KNOWN_DEVICES_FILE, 'w') as f:
        json.dump(known, f, indent=2)

def log_raw_syslog(message, ip):
    """Append raw syslog to local rotating log file."""
    timestamp = datetime.now().isoformat()
    with open(LOG_FILE, 'a') as f:
        f.write(f"[{timestamp}] <{ip}> {message.strip()}\n")

def process_syslog_message(message, ip):
    """Stateful parser for network client events and anomaly detection."""
    msg_str = message.decode('utf-8', errors='ignore')
    log_raw_syslog(msg_str, ip)
    
    # Check if message contains WPA or DHCP activity
    msg_lower = msg_str.lower()
    is_network_event = any(term in msg_lower for term in ['dhcp', 'wpa', 'auth', 'assoc', 'lease', 'client'])
    
    if not is_network_event:
        return

    # Extract MAC and IP
    mac_match = MAC_PATTERN.search(msg_str)
    ip_match = IP_PATTERN.search(msg_str)
    
    if not mac_match:
        return

    mac = mac_match.group(1).upper().replace('-', ':')
    assigned_ip = ip_match.group(1) if ip_match else None
    
    known_devices = get_known_devices()
    
    # State mapping for client activity
    event_type = "UNKNOWN"
    if "disassoc" in msg_lower or "deauth" in msg_lower or "offline" in msg_lower:
        event_type = "DISCONNECTION"
    elif "request" in msg_lower or "ack" in msg_lower or "lease" in msg_lower:
        event_type = "DHCP_ASSIGNMENT"
    elif "auth" in msg_lower or "assoc" in msg_lower:
        event_type = "WIRELESS_ASSOCIATION"

    # 1. Anomaly Detection
    if mac not in known_devices:
        logging.warning(f"SECURITY ANOMALY: Unrecognized MAC Address '{mac}' detected on network! Event: {event_type} | Message: {msg_str.strip()}")
        # Log anomaly to file
        anomaly_entry = {
            "timestamp": datetime.now().isoformat(),
            "mac": mac,
            "ip": assigned_ip,
            "event_type": event_type,
            "raw_message": msg_str.strip()
        }
        with open(ANOMALY_FILE, 'a') as f_anom:
            f_anom.write(json.dumps(anomaly_entry) + '\n')
            
        # Dynamically auto-register new device temporarily as unknown
        add_known_device(mac, f"UNRECOGNIZED_NODE_{mac[-5:]}")
    
    # 2. Toyota Venza Mesh Tracking
    # Detect the Venza connecting or disconnecting
    # Check if the MAC matches a newly discovered Toyota multimedia system or WPA handshake
    is_venza = False
    if "toyota" in msg_lower or "venza" in msg_lower or "multimedia" in msg_lower:
        is_venza = True
        
    # Read Venza state to see if it's already bound
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r') as f_state:
            state_data = json.load(f_state)
            
        # If this is the Venza or matches our bound Venza MAC
        state_mac = state_data.get('mac_address')
        if (state_mac and mac.upper() == state_mac.upper()) or is_venza:
            logging.info(f"VEHICLE NODE SIGNAL: Venza {event_type} event detected! MAC: {mac} | IP: {assigned_ip}")
            
            status_changed = (event_type != "DISCONNECTION") != (state_data.get('mesh_status') == 'CONNECTED')
            
            state_data['registered'] = True
            state_data['mac_address'] = mac.lower()
            state_data['ip_address'] = assigned_ip or state_data.get('ip_address')
            state_data['last_seen'] = datetime.now().isoformat()
            state_data['mesh_status'] = "CONNECTED" if event_type != "DISCONNECTION" else "DISCONNECTED"
            
            history_entry = {
                "timestamp": datetime.now().isoformat(),
                "state": "home" if event_type != "DISCONNECTION" else "offline",
                "event": event_type,
                "ip": assigned_ip
            }
            state_data['history'].append(history_entry)
            
            with open(STATE_FILE, 'w') as f_state_out:
                json.dump(state_data, f_state_out, indent=2)
                
            if status_changed:
                if state_data['mesh_status'] == "CONNECTED":
                    logging.info("Venza connected to Home Wi-Fi. Initializing driveway greeting & RAG telemetry intake...")
                    import subprocess
                    subprocess.Popen([sys.executable, "/app/creative-liberation-engine/scripts/toyota_telemetry_harvest.py"])
                else:
                    logging.info("Venza disassociated/powered off. Locking mobility node session.")

def udp_server():
    """UDP Syslog listener on port 514."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.bind(('0.0.0.0', 514))
        logging.info("Sovereign UDP Syslog Server actively listening on port 514...")
    except Exception as e:
        logging.error(f"Failed to bind UDP port 514: {e}. Check if another service is using it.")
        sys.exit(1)
        
    while True:
        data, addr = sock.recvfrom(4096)
        threading.Thread(target=process_syslog_message, args=(data, addr[0])).start()

if __name__ == '__main__':
    udp_server()
