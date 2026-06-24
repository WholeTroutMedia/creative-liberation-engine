#!/usr/bin/env python3
"""
ZIG SIM to WebGL/HTML5 Generative Art SSE Bridge
Part of the Creative Liberation Engine V6 Suite

A zero-dependency server that:
1. Listens to ZIG SIM real-time JSON packets over UDP.
2. Serves a beautiful, interactive generative art canvas on port 8080.
3. Streams incoming mobile sensor data to the browser client using Server-Sent Events (SSE).
"""

import sys
import os
import json
import socket
import threading
import queue
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ANSI Formatting
RESET = "\033[0m"
BOLD = "\033[1m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
MAGENTA = "\033[35m"

# Set of active client queues receiving telemetry broadcasts
active_queues = []
queues_lock = threading.Lock()

class TelemetryBridgeHandler(BaseHTTPRequestHandler):
    """Handles serving the Web Art interface and broadcasting real-time SSE telemetry."""
    
    def log_message(self, format, *args):
        # Silence normal HTTP logging to keep console clean for the stream overview
        pass

    def do_GET(self):
        # Resolve static assets from compiled nexus React app
        dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../apps/nexus/dist'))
        
        if self.path == '/stream':
            # Establish persistent Server-Sent Events channel with browser
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            # Register connection queue
            q = queue.Queue(maxsize=20)
            with queues_lock:
                active_queues.append(q)

            try:
                # Keep persistent connection open, pushing queued socket payloads
                while True:
                    try:
                        data = q.get(timeout=2.0)
                        self.wfile.write(f"data: {data}\n\n".encode('utf-8'))
                        self.wfile.flush()
                    except queue.Empty:
                        # Keep-alive heartbeat comment to prevent client timeout
                        self.wfile.write(": ping\n\n".encode('utf-8'))
                        self.wfile.flush()
            except Exception:
                # Client disconnected or closed tab
                pass
            finally:
                # Unregister connection queue
                with queues_lock:
                    if q in active_queues:
                        active_queues.remove(q)
        else:
            # Serve static files from compiled React dist folder
            rel_path = self.path.lstrip('/')
            if not rel_path or rel_path == '':
                rel_path = 'index.html'
                
            # Prevent directory traversal vulnerability
            target_path = os.path.abspath(os.path.join(dist_dir, rel_path))
            if not target_path.startswith(dist_dir):
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"403 Forbidden")
                return

            if os.path.exists(target_path) and os.path.isfile(target_path):
                # Resolve content type
                ext = os.path.splitext(target_path)[1].lower()
                mime_types = {
                    '.html': 'text/html; charset=utf-8',
                    '.css': 'text/css; charset=utf-8',
                    '.js': 'application/javascript; charset=utf-8',
                    '.mjs': 'application/javascript; charset=utf-8',
                    '.json': 'application/json; charset=utf-8',
                    '.svg': 'image/svg+xml',
                    '.glb': 'model/gltf-binary',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.ico': 'image/x-icon'
                }
                content_type = mime_types.get(ext, 'application/octet-stream')
                
                try:
                    with open(target_path, 'rb') as f:
                        file_data = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(len(file_data)))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                    self.send_header('Pragma', 'no-cache')
                    self.send_header('Expires', '0')
                    self.end_headers()
                    self.wfile.write(file_data)
                except Exception as e:
                    self.send_response(500)
                    self.end_headers()
                    self.wfile.write(f"500 Internal Error: {e}".encode('utf-8'))
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"404 Not Found")

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

def udp_telemetry_listener(port):
    """Spawns an asynchronous listener that binds to the ZIG SIM UDP port."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.bind(('0.0.0.0', port))
        while True:
            data_bytes, addr = sock.recvfrom(65535)
            try:
                payload = json.loads(data_bytes.decode('utf-8'))
                
                # If ZIG SIM sends a batched list of updates, unpack them
                if isinstance(payload, list):
                    for item in payload:
                        raw_json = json.dumps(item)
                        with queues_lock:
                            for q in active_queues:
                                if not q.full():
                                    q.put_nowait(raw_json)
                else:
                    raw_json = json.dumps(payload)
                    with queues_lock:
                        for q in active_queues:
                            if not q.full():
                                q.put_nowait(raw_json)
                                
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass
    except Exception as e:
        print(f"FATAL: Failed to bind UDP telemetry listener to port {port}: {e}")
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(1)
    finally:
        sock.close()

def handle_tcp_client(conn):
    """Handles an individual TCP client connection, parsing raw JSON streams via brace-balancing."""
    try:
        buffer = ""
        while True:
            data = conn.recv(131072).decode('utf-8', errors='ignore')
            if not data:
                break
            buffer += data
            
            # Balance brackets to safely slice stream frames under any packet fragmentation
            while True:
                start = buffer.find('{')
                if start == -1:
                    if len(buffer) > 65536:
                        buffer = ""  # Discard garbage if buffer is ballooning
                    break
                
                brace_count = 0
                end = -1
                in_string = False
                escape = False
                
                # Search for the end of the JSON object matching the balanced start brace
                for i in range(start, len(buffer)):
                    char = buffer[i]
                    if char == '"' and not escape:
                        in_string = not in_string
                    elif char == '\\' and in_string:
                        escape = not escape
                    else:
                        escape = False
                        
                    if not in_string:
                        if char == '{':
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                end = i
                                break
                
                if end != -1:
                    json_str = buffer[start:end+1]
                    buffer = buffer[end+1:]
                    
                    try:
                        payload = json.loads(json_str)
                        raw_json = json.dumps(payload)
                        with queues_lock:
                            for q in active_queues:
                                if not q.full():
                                    q.put_nowait(raw_json)
                    except json.JSONDecodeError:
                        pass
                else:
                    # Incomplete frame; wait for next recv
                    break
    except Exception:
        pass
    finally:
        conn.close()

def tcp_telemetry_listener(port):
    """Spawns an asynchronous TCP listener to handle connection-based high-throughput sensor telemetry."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(('0.0.0.0', port))
        sock.listen(5)
        while True:
            conn, addr = sock.accept()
            t = threading.Thread(target=handle_tcp_client, args=(conn,), daemon=True)
            t.start()
    except Exception as e:
        print(f"FATAL: Failed to bind TCP telemetry listener to port {port}: {e}")
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(1)
    finally:
        sock.close()

def main():
    parser = argparse.ArgumentParser(description="ZIG SIM Generative Art HTTP/SSE Bridge.")
    parser.add_argument("-port", "--port", type=int, default=8181, help="ZIG SIM incoming port (default: 8181)")
    parser.add_argument("-http", "--http-port", type=int, default=8182, help="Local Web Dashboard HTTP port (default: 8182)")
    args = parser.parse_args()

    local_ip = get_local_ip()

    # 1. Start the UDP telemetry receiver in a background thread
    udp_thread = threading.Thread(
        target=udp_telemetry_listener, 
        args=(args.port,), 
        daemon=True
    )
    udp_thread.start()

    # 2. Start the TCP telemetry receiver in a background thread
    tcp_thread = threading.Thread(
        target=tcp_telemetry_listener, 
        args=(args.port,), 
        daemon=True
    )
    tcp_thread.start()

    # 3. Run the HTTP/SSE server in the main thread
    ThreadingHTTPServer.allow_reuse_address = True
    server = ThreadingHTTPServer(('0.0.0.0', args.http_port), TelemetryBridgeHandler)

    print(f"\n{BOLD}{CYAN}+====================================================================================+{RESET}")
    print(f"{BOLD}{CYAN}|            CLE ENGINE V6 -- GENERATIVE ART TELEMETRY BRIDGE                  |{RESET}")
    print(f"{BOLD}{CYAN}+====================================================================================+{RESET}\n")
    print(f"  {BOLD}1. CONFIGURE YOUR IPHONE:{RESET}")
    print(f"     |-- Install {BOLD}ZIG SIM{RESET} from the App Store.")
    print(f"     |-- In {BOLD}SETTINGS{RESET}, set format to {GREEN}JSON{RESET} and protocol to {GREEN}TCP{RESET} (Required for Camera stream).")
    print(f"     |-- Enter IP Address: {BOLD}{CYAN}{local_ip}{RESET}")
    print(f"     |-- Enter Port:       {BOLD}{CYAN}{args.port}{RESET}")
    print(f"     |-- Tap {BOLD}SENSOR{RESET} and enable: {MAGENTA}IMAGE, ACCEL, GYRO, GRAVITY, COMPASS, TOUCH{RESET}.")
    print(f"     |-- Tap {BOLD}START{RESET} on the main screen.")
    print()
    print(f"  {BOLD}2. OPEN THE DIGITAL CANVAS:{RESET}")
    print(f"     |-- Open browser at: {BOLD}{GREEN}http://localhost:{args.http_port}/{RESET}")
    print()
    print(f"  {BOLD}3. ACTIVE CONNECTIONS:{RESET}")
    print(f"     |-- Telemetry channels open on UDP & TCP Port {args.port}...{RESET}")
    print()
    print(f"{BOLD}{CYAN}Press Ctrl+C to terminate the bridge and web server cleanly.{RESET}\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"\n{BOLD}{YELLOW}Generative Art Telemetry Bridge shutdown requested. Cleaning servers.{RESET}")
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
