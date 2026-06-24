#!/usr/bin/env python3
"""
ZIG SIM Live Sensor Receiver & Analytics Dashboard
Part of the Creative Liberation Engine V6 Suite

Listens to ZIG SIM JSON streams (UDP/TCP) and visualizes real-time mobile sensor
telemetry (accelerometer, gyroscope, GPS, battery, pressure, compass, touch).
"""

import sys
import os
import json
import socket
import argparse
from datetime import datetime

# ANSI Colors for premium CLE visual styling
CLEAR_SCREEN = "\033[2J\033[H"
RESET = "\033[0m"
BOLD = "\033[1m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
MAGENTA = "\033[35m"
RED = "\033[31m"
BLUE = "\033[34m"

def get_local_ip():
    """Auto-detects the local IP address of this machine to help the user configure ZIG SIM."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def format_gauge(value, min_val, max_val, width=15):
    """Generates a premium visual gauge representation for numeric values."""
    clamped = max(min(value, max_val), min_val)
    percentage = (clamped - min_val) / (max_val - min_val)
    filled_width = int(percentage * width)
    empty_width = width - filled_width
    bar = "█" * filled_width + "░" * empty_width
    return bar

def draw_dashboard(data, source_addr, port, protocol, record_path):
    """Draws a real-time responsive dashboard containing high-fidelity sensor readouts."""
    sys.stdout.write(CLEAR_SCREEN)
    
    # Header Panel
    sys.stdout.write(f"{BOLD}{CYAN}╔════════════════════════════════════════════════════════════════════════════════════╗{RESET}\n")
    sys.stdout.write(f"{BOLD}{CYAN}║              CLE ENGINE V6 ── ZIG SIM REAL-TIME SENSOR STREAM                ║{RESET}\n")
    sys.stdout.write(f"{BOLD}{CYAN}╚════════════════════════════════════════════════════════════════════════════════════╝{RESET}\n\n")
    
    # Stream Status Panel
    sys.stdout.write(f"  {BOLD}STREAM METRICS:{RESET}\n")
    sys.stdout.write(f"  ├── {BOLD}Protocol:{RESET} {protocol.upper()}\n")
    sys.stdout.write(f"  ├── {BOLD}Listening Port:{RESET} {port}\n")
    sys.stdout.write(f"  ├── {BOLD}Connected Device IP:{RESET} {source_addr[0]}\n")
    sys.stdout.write(f"  └── {BOLD}Recording To:{RESET} {record_path if record_path else 'Disabled (Run with --record to save)'}\n\n")
    
    sensordata = data.get("sensordata", {})
    device_info = data.get("device", {})
    
    # Device Meta
    device_name = device_info.get("name", "Unknown iPhone")
    uuid = device_info.get("uuid", "N/A")
    sys.stdout.write(f"  {BOLD}DEVICE INFO:{RESET}\n")
    sys.stdout.write(f"  └── {BOLD}Name:{RESET} {GREEN}{device_name}{RESET} | {BOLD}UUID:{RESET} {CYAN}{uuid[:18]}...{RESET}\n\n")
    
    sys.stdout.write(f"  {BOLD}ACTIVE REAL-TIME TELEMETRY:{RESET}\n")
    
    # Motion / Accelerometer
    accel = sensordata.get("accel", {})
    if accel:
        ax, ay, az = accel.get("x", 0.0), accel.get("y", 0.0), accel.get("z", 0.0)
        sys.stdout.write(f"  ├── {BOLD}Accelerometer (G):{RESET}\n")
        sys.stdout.write(f"  │   ├── X: {YELLOW}{ax:+.4f}{RESET}  [{format_gauge(ax, -2.0, 2.0)}]\n")
        sys.stdout.write(f"  │   ├── Y: {YELLOW}{ay:+.4f}{RESET}  [{format_gauge(ay, -2.0, 2.0)}]\n")
        sys.stdout.write(f"  │   └── Z: {YELLOW}{az:+.4f}{RESET}  [{format_gauge(az, -2.0, 2.0)}]\n")
    else:
        sys.stdout.write(f"  ├── {BOLD}Accelerometer:{RESET} {RED}Inactive / Not Streamed{RESET}\n")
        
    # Gyroscope
    gyro = sensordata.get("gyro", {})
    if gyro:
        gx, gy, gz = gyro.get("x", 0.0), gyro.get("y", 0.0), gyro.get("z", 0.0)
        sys.stdout.write(f"  ├── {BOLD}Gyroscope (rad/s):{RESET}\n")
        sys.stdout.write(f"  │   ├── X: {CYAN}{gx:+.4f}{RESET}  [{format_gauge(gx, -10.0, 10.0)}]\n")
        sys.stdout.write(f"  │   ├── Y: {CYAN}{gy:+.4f}{RESET}  [{format_gauge(gy, -10.0, 10.0)}]\n")
        sys.stdout.write(f"  │   └── Z: {CYAN}{gz:+.4f}{RESET}  [{format_gauge(gz, -10.0, 10.0)}]\n")
    else:
        sys.stdout.write(f"  ├── {BOLD}Gyroscope:{RESET} {RED}Inactive{RESET}\n")

    # Compass / Orientation
    compass = sensordata.get("compass", {})
    gravity = sensordata.get("gravity", {})
    if compass or gravity:
        heading = compass.get("faceheading", 0.0)
        grav_z = gravity.get("z", 0.0)
        sys.stdout.write(f"  ├── {BOLD}Orientation:{RESET}\n")
        sys.stdout.write(f"  │   ├── Face Heading: {MAGENTA}{heading:.1f}°{RESET}\n")
        sys.stdout.write(f"  │   └── Z-Gravity:    {MAGENTA}{grav_z:+.4f}{RESET}\n")
    else:
        sys.stdout.write(f"  ├── {BOLD}Orientation:{RESET} {RED}Inactive{RESET}\n")

    # Battery
    battery = sensordata.get("battery", {})
    if battery:
        level = battery.get("level", 1.0) * 100
        state = battery.get("state", "unknown")
        bat_color = GREEN if level > 25 else RED
        sys.stdout.write(f"  ├── {BOLD}Battery Status:{RESET}\n")
        sys.stdout.write(f"  │   └── Level: {bat_color}{level:.1f}%{RESET} [{format_gauge(level, 0, 100)}] ({state})\n")
    else:
        sys.stdout.write(f"  ├── {BOLD}Battery Status:{RESET} {RED}Inactive{RESET}\n")

    # GPS / Coordinates
    gps = sensordata.get("gps", {})
    if gps:
        lat, lon = gps.get("latitude", 0.0), gps.get("longitude", 0.0)
        alt = gps.get("altitude", 0.0)
        sys.stdout.write(f"  └── {BOLD}Spatial Location (GPS):{RESET}\n")
        sys.stdout.write(f"      ├── Latitude:  {GREEN}{lat:.7f}°{RESET}\n")
        sys.stdout.write(f"      ├── Longitude: {GREEN}{lon:.7f}°{RESET}\n")
        sys.stdout.write(f"      └── Altitude:  {GREEN}{alt:.2f}m{RESET}\n")
    else:
        sys.stdout.write(f"  └── {BOLD}Spatial Location (GPS):{RESET} {RED}Inactive{RESET}\n")

    sys.stdout.write(f"\n{BOLD}{CYAN}Press Ctrl+C to terminate the socket server safely.{RESET}\n")
    sys.stdout.flush()

def start_receiver(port, protocol, record_path=None):
    """Initializes and runs the high-performance network listener."""
    local_ip = get_local_ip()
    
    print(f"{BOLD}{GREEN}Starting CLE ZIG SIM Service...{RESET}")
    print(f"{BOLD}Configuration details:{RESET}")
    print(f"  ├── Local IP Address: {BOLD}{CYAN}{local_ip}{RESET} <-- Enter this in ZIG SIM as 'IP Address'")
    print(f"  ├── Port:             {BOLD}{CYAN}{port}{RESET} <-- Enter this in ZIG SIM as 'Port'")
    print(f"  ├── Protocol:         {BOLD}{CYAN}{protocol.upper()}{RESET} <-- Match this in ZIG SIM")
    print(f"  └── Format:           {BOLD}{CYAN}JSON{RESET} <-- Select 'JSON' in ZIG SIM")
    print(f"\n{YELLOW}Waiting for initial stream packets... Make sure to hit 'START' inside ZIG SIM app.{RESET}\n")

    log_file = None
    if record_path:
        os.makedirs(os.path.dirname(record_path), exist_ok=True)
        log_file = open(record_path, "a", encoding="utf-8")

    if protocol == "udp":
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.bind(('0.0.0.0', port))
            while True:
                data_bytes, addr = sock.recvfrom(65535)
                try:
                    payload = json.loads(data_bytes.decode('utf-8'))
                    
                    # If ZIG SIM sends a list (often wrapped as a batch)
                    if isinstance(payload, list):
                        for item in payload:
                            draw_dashboard(item, addr, port, protocol, record_path)
                            if log_file:
                                log_file.write(json.dumps(item) + "\n")
                                log_file.flush()
                    else:
                        draw_dashboard(payload, addr, port, protocol, record_path)
                        if log_file:
                            log_file.write(json.dumps(payload) + "\n")
                            log_file.flush()
                            
                except json.JSONDecodeError:
                    # Gracefully skip malformed packets
                    pass
        except KeyboardInterrupt:
            print(f"\n\n{BOLD}{YELLOW}ZIG SIM Receiver shutdown requested. Cleaning sockets.{RESET}")
        finally:
            sock.close()
            if log_file:
                log_file.close()
    
    else:  # TCP
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(('0.0.0.0', port))
            sock.listen(1)
            while True:
                conn, addr = sock.accept()
                try:
                    buffer = ""
                    while True:
                        data = conn.recv(4096).decode('utf-8')
                        if not data:
                            break
                        buffer += data
                        
                        # Process newline-separated JSON frames
                        while "\n" in buffer:
                            line, buffer = buffer.split("\n", 1)
                            if not line.strip():
                                continue
                            try:
                                payload = json.loads(line)
                                if isinstance(payload, list):
                                    for item in payload:
                                        draw_dashboard(item, addr, port, protocol, record_path)
                                        if log_file:
                                            log_file.write(json.dumps(item) + "\n")
                                            log_file.flush()
                                else:
                                    draw_dashboard(payload, addr, port, protocol, record_path)
                                    if log_file:
                                        log_file.write(json.dumps(payload) + "\n")
                                        log_file.flush()
                            except json.JSONDecodeError:
                                pass
                except Exception as e:
                    pass
                finally:
                    conn.close()
        except KeyboardInterrupt:
            print(f"\n\n{BOLD}{YELLOW}ZIG SIM Receiver shutdown requested. Cleaning sockets.{RESET}")
        finally:
            sock.close()
            if log_file:
                log_file.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Live ZIG SIM JSON stream parser.")
    parser.add_argument("-p", "--port", type=int, default=5000, help="Socket port (default: 5000)")
    parser.add_argument("-proto", "--protocol", choices=["udp", "tcp"], default="udp", help="Network protocol (default: udp)")
    parser.add_argument("-r", "--record", action="store_true", help="Record incoming sensor metrics to log file")
    
    args = parser.parse_args()
    
    log_path = None
    if args.record:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_path = os.path.abspath(os.path.join(
            os.path.dirname(__file__), 
            "../runtime/session/zigsim_streams", 
            f"stream_{timestamp}.jsonl"
        ))
        
    start_receiver(args.port, args.protocol, log_path)
