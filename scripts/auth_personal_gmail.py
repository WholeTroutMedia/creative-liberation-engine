#!/usr/bin/env python3
"""
Sovereign AutoMesh: Personal Google Account OAuth Conductor
Run this script locally on the workstation to authenticate 'inquiries@creativeliberationengine.org'
and save updated tokens directly to the NAS credentials folder.
"""

import os
import sys
import json
import http.server
import urllib.parse
import webbrowser
import requests

def get_resolved_path(unix_path):
    if os.name == 'nt':
        return unix_path.replace("/app/creative-liberation-engine/", "y:\\creative-liberation-engine\\").replace("/", "\\")
    return unix_path

CREDS_PATH = get_resolved_path("/app/creative-liberation-engine/runtime/session/credentials/inquiries@creativeliberationengine.org.json")
PORT = 8000
REDIRECT_URI = f"http://localhost:{PORT}"

# Client credentials from the existing project configuration
CLIENT_ID = "759644855630-lbqb213qdpnf4knsq9m89qfp0jvd43qd.apps.googleusercontent.com"
CLIENT_SECRET = "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"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid"
]

class OAuthCallbackHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress server logs to keep terminal output clean
        return

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed_path.query)
        
        if 'code' in query:
            code = query['code'][0]
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b"<h1>Authorization successful!</h1><p>You can close this tab and return to the terminal.</p>")
            
            print("\nExchanging authorization code for tokens...")
            token_url = "https://oauth2.googleapis.com/token"
            payload = {
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "code": code,
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code"
            }
            resp = requests.post(token_url, data=payload)
            if resp.status_code == 200:
                tokens = resp.json()
                
                # Preserve existing data if available
                existing_data = {}
                if os.path.exists(CREDS_PATH):
                    try:
                        with open(CREDS_PATH, 'r') as f:
                            existing_data = json.load(f)
                    except:
                        pass
                
                # Merge tokens
                creds = {
                    "token": tokens.get("access_token"),
                    "refresh_token": tokens.get("refresh_token") or existing_data.get("refresh_token"),
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                    "scopes": SCOPES,
                    "expiry": ""
                }
                
                if not creds["refresh_token"]:
                    print("⚠️ WARNING: Google did not return a refresh token. If this occurs, you may need to go to your Google Account Settings -> Security -> Third-party apps and revoke access for 'Creative Liberation Engine', then re-run this script to force a full consent screen.")
                
                # Write back to NAS
                os.makedirs(os.path.dirname(CREDS_PATH), exist_ok=True)
                with open(CREDS_PATH, 'w') as f:
                    json.dump(creds, f, indent=2)
                print(f"✅ Credentials successfully saved to {CREDS_PATH}!")
                
                # Stop server
                sys.exit(0)
            else:
                print(f"❌ Failed to exchange code: {resp.text}")
                sys.exit(1)
        else:
            self.send_response(400)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b"<h1>Authorization failed!</h1><p>No authorization code found in request.</p>")

def main():
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "login_hint": "inquiries@creativeliberationengine.org"
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    
    print("==================================================")
    print("  Personal Google Account OAuth Conductor")
    print("==================================================")
    print("Opening browser for Google Workspace authorization...")
    print(f"URL: {auth_url}")
    print("==================================================")
    
    server = http.server.HTTPServer(('localhost', PORT), OAuthCallbackHandler)
    webbrowser.open(auth_url)
    
    try:
        server.handle_request()
    except KeyboardInterrupt:
        print("\nAborted.")

if __name__ == "__main__":
    main()
