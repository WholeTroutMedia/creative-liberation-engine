#!/usr/bin/env python3
"""
Sovereign AutoMesh: QuickBooks Online OAuth 2.0 Auth Bridge with localtunnel
Launches a temporary local web server and localtunnel tunnel via npx to handle QBO authorization,
exchanges the callback code for access/refresh tokens, and saves them to the database.
"""

import os
import sys
import json
import time
import sqlite3
import logging
import webbrowser
import requests
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] AutoMesh-QBO-Auth: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

PORT = 5050

def get_resolved_path(unix_path):
    if os.name == 'nt':
        return unix_path.replace("/app/creative-liberation-engine/", "y:\\creative-liberation-engine\\").replace("/", "\\")
    return unix_path

DB_PATH = get_resolved_path("/app/creative-liberation-engine/runtime/db/ledger.db")

# Global state
auth_code = None
realm_id = None

class OAuthCallbackHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        global auth_code, realm_id
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/callback':
            query = parse_qs(parsed_path.query)
            auth_code = query.get('code', [None])[0]
            realm_id = query.get('realmId', [None])[0]
            
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            
            html = """
            <html>
                <head>
                    <title>Authorization Successful</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #121212; color: #ffffff; text-align: center; padding-top: 100px; }
                        h1 { color: #2ecc71; }
                        .container { background-color: #1e1e1e; padding: 40px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>QuickBooks Connected Successfully!</h1>
                        <p>You can close this tab and return to the terminal.</p>
                    </div>
                </body>
            </html>
            """
            self.wfile.write(html.encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run_migration():
    """Ensure quickbooks_config table has a realm_id column."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE quickbooks_config ADD COLUMN realm_id TEXT")
        logging.info("Migration: Added realm_id column to quickbooks_config table.")
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()

def main():
    global auth_code, realm_id
    run_migration()
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM quickbooks_config WHERE id = 1")
    row = cursor.fetchone()
    conn.close()
    
    if not row or not row["client_id"] or not row["client_secret"]:
        logging.error("QuickBooks client_id or client_secret is missing from the database.")
        sys.exit(1)
        
    client_id = row["client_id"]
    client_secret = row["client_secret"]
    
    # 1. Start localtunnel locally on port 5050
    logging.info("Starting localtunnel via npx...")
    lt_cmd = ["npx.cmd", "localtunnel", "--port", str(PORT)] if os.name == 'nt' else ["npx", "localtunnel", "--port", str(PORT)]
    
    try:
        tunnel_proc = subprocess.Popen(
            lt_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
    except Exception as e:
        logging.error(f"Failed to launch localtunnel: {e}")
        sys.exit(1)
        
    # Get public URL from localtunnel stdout
    public_url = None
    start_time = time.time()
    while time.time() - start_time < 12:
        line = tunnel_proc.stdout.readline()
        if not line:
            break
        line_clean = line.strip()
        if "your url is:" in line_clean.lower():
            parts = line_clean.split()
            for p in parts:
                if "https://" in p:
                    public_url = p.strip()
                    break
            if public_url:
                break
                
    if not public_url:
        logging.error("Failed to establish localtunnel or extract public HTTPS URL.")
        tunnel_proc.terminate()
        sys.exit(1)
        
    redirect_uri = f"{public_url}/callback"
    logging.info(f"localtunnel Established: {public_url}")
    logging.info(f"Redirect URI configured: {redirect_uri}")
    
    print("\n" + "="*80)
    print("ACTION REQUIRED:")
    print(f"Please copy and add this Redirect URI in your Intuit Developer portal settings:")
    print(f"  -->  {redirect_uri}")
    print("="*80 + "\n")
    
    input("Press Enter once you have saved the Redirect URI on developer.intuit.com...")
    
    # Generate Auth URL
    auth_base_url = "https://appcenter.intuit.com/connect/oauth2"
    params = {
        "client_id": client_id,
        "response_type": "code",
        "scope": "com.intuit.quickbooks.accounting",
        "redirect_uri": redirect_uri,
        "state": "secure_state"
    }
    url_parts = [f"{k}={requests.utils.quote(v)}" for k, v in params.items()]
    auth_url = f"{auth_base_url}?{'&'.join(url_parts)}"
    
    # Start temporary local HTTP server
    server = HTTPServer(('localhost', PORT), OAuthCallbackHandler)
    logging.info("Opening QuickBooks authorization page in your browser...")
    
    webbrowser.open(auth_url)
    print(f"\nIf the browser did not open automatically, please click this link:\n{auth_url}\n")
    
    # Wait for the callback request
    try:
        while auth_code is None:
            server.handle_request()
    except KeyboardInterrupt:
        logging.info("Server stopped manually.")
        tunnel_proc.terminate()
        sys.exit(0)
    finally:
        tunnel_proc.terminate()
        
    if not auth_code:
        logging.error("Failed to retrieve authorization code from callback.")
        sys.exit(1)
        
    logging.info(f"Authorization code received. Exchanging tokens (Realm ID: {realm_id})...")
    
    # Exchange authorization code for tokens
    token_url = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    payload = {
        "grant_type": "authorization_code",
        "code": auth_code,
        "redirect_uri": redirect_uri
    }
    
    resp = requests.post(token_url, data=payload, auth=(client_id, client_secret), headers=headers)
    
    if resp.status_code != 200:
        logging.error(f"Token exchange failed: {resp.text}")
        sys.exit(1)
        
    token_data = resp.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)
    expires_at = int(time.time()) + expires_in
    
    # Save tokens and realm_id back to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE quickbooks_config
        SET access_token = ?, refresh_token = ?, token_expires_at = ?, realm_id = ?
        WHERE id = 1
    """, (access_token, refresh_token, expires_at, realm_id))
    conn.commit()
    conn.close()
    
    logging.info("Authorization tokens successfully saved to ledger.db!")
    logging.info("QuickBooks is now fully integrated for background automation.")

if __name__ == "__main__":
    main()
