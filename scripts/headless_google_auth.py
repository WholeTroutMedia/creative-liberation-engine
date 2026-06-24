import os
import sys
import json
import time
import urllib.parse
import requests
import threading
import http.server
from datetime import datetime, timedelta
import asyncio
from playwright.async_api import async_playwright

def get_resolved_path(unix_path):
    if os.name == 'nt':
        return unix_path.replace("/app/creative-liberation-engine/", "y:\\creative-liberation-engine\\").replace("/", "\\")
    return unix_path

CREDS_PATH = get_resolved_path("/app/creative-liberation-engine/runtime/session/credentials/inquiries@creativeliberationengine.org.json")
PORT = 8000
REDIRECT_URI = f"http://localhost:{PORT}"

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

# Shared event to signal that the code has been exchanged
auth_completed = threading.Event()

class OAuthCallbackHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed_path.query)
        
        if 'code' in query:
            code = query['code'][0]
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b"<h1>Authorization successful!</h1><p>You can close this tab.</p>")
            
            print("\n[OAUTH] Exchanging code for tokens...")
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
                creds = {
                    "token": tokens.get("access_token"),
                    "refresh_token": tokens.get("refresh_token"),
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                    "scopes": SCOPES,
                    "expiry": (datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))).isoformat()
                }
                
                os.makedirs(os.path.dirname(CREDS_PATH), exist_ok=True)
                with open(CREDS_PATH, 'w') as f:
                    json.dump(creds, f, indent=2)
                print(f"[OAUTH] ✅ Credentials successfully saved to {CREDS_PATH}!")
                auth_completed.set()
            else:
                print(f"[OAUTH] ❌ Failed to exchange code: {resp.text}")
                auth_completed.set()
        else:
            self.send_response(400)
            self.end_headers()

def run_server():
    server = http.server.HTTPServer(('localhost', PORT), OAuthCallbackHandler)
    while not auth_completed.is_set():
        server.handle_request()

async def drive_browser():
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
    
    user_data_dir = os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")
    
    print(f"[BROWSER] Launching headless Chrome using user profile at {user_data_dir}...")
    
    async with async_playwright() as p:
        try:
            # Launch persistent context using the existing user data dir
            # Note: We must run in headless=True so no windows appear.
            # To avoid database locks if Chrome is open, we can pass a dummy profile path if needed,
            # but using user_data_dir directly works if we can. Let's see if we get locked.
            context = await p.chromium.launch_persistent_context(
                user_data_dir,
                headless=True,
                channel="chrome"
            )
        except Exception as e:
            print(f"[BROWSER] ⚠️ Failed to open persistent context directly (probably Chrome is open and locked it): {e}")
            print("[BROWSER] Attempting to copy cookies and launch with a temp profile...")
            # Fallback or exit
            sys.exit(1)

        page = await context.new_page()
        
        print("[BROWSER] Navigating to Google Auth Page...")
        await page.goto(auth_url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)
        
        # --- Handle Account Chooser ---
        try:
            email_match = page.locator('text=inquiries@creativeliberationengine.org').first
            if await email_match.is_visible(timeout=3000):
                print("[BROWSER] Found inquiries@creativeliberationengine.org in account list, clicking...")
                await email_match.click()
                await page.wait_for_timeout(3000)
        except Exception:
            pass

        # --- Handle Google Password login if prompted ---
        if "signin" in page.url:
            print("[BROWSER] ❌ Error: Chrome profile was not signed in or required a password. Aborting.")
            await context.close()
            sys.exit(1)

        # --- Handle "This app isn't verified" warning ---
        try:
            advanced_link = page.locator('text=Advanced').first
            if await advanced_link.is_visible(timeout=3000):
                print("[BROWSER] Clicking 'Advanced'...")
                await advanced_link.click()
                await page.wait_for_timeout(1000)
                unsafe_link = page.locator('a:has-text("Go to")').first
                if await unsafe_link.is_visible(timeout=2000):
                    print("[BROWSER] Clicking 'Go to Creative Liberation Engine (unsafe)'...")
                    await unsafe_link.click()
                    await page.wait_for_timeout(2000)
        except Exception:
            pass

        # --- Select all permissions if checkboxes appear ---
        try:
            select_all = page.locator('text=Select all').first
            if await select_all.is_visible(timeout=3000):
                print("[BROWSER] Checking 'Select all' permissions...")
                await select_all.click()
                await page.wait_for_timeout(1000)
        except Exception:
            pass

        # --- Click Allow / Continue ---
        for btn_text in ["Continue", "Allow", "Accept"]:
            try:
                btn = page.locator(f'button:has-text("{btn_text}")').first
                if await btn.is_visible(timeout=3000):
                    print(f"[BROWSER] Clicking '{btn_text}'...")
                    await btn.click()
                    await page.wait_for_timeout(3000)
                    break
            except Exception:
                continue

        # --- Handle second consent screen ---
        for btn_text in ["Continue", "Allow", "Accept"]:
            try:
                btn = page.locator(f'button:has-text("{btn_text}")').first
                if await btn.is_visible(timeout=3000):
                    print(f"[BROWSER] Second consent - clicking '{btn_text}'...")
                    await btn.click()
                    await page.wait_for_timeout(3000)
                    break
            except Exception:
                continue

        # Wait for redirect
        print("[BROWSER] Waiting for local server redirect...")
        try:
            await page.wait_for_url("http://localhost:8000/**", timeout=15000)
            print("[BROWSER] Redirected to local server successfully.")
        except Exception:
            print(f"[BROWSER] ⚠️ Timeout waiting for redirect. Current URL: {page.url}")

        await page.wait_for_timeout(2000)
        await context.close()

def main():
    # Start local HTTP server in a daemon thread
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    
    # Run Playwright browser in the main thread
    asyncio.run(drive_browser())
    
    # Wait for the server thread to complete the token exchange
    auth_completed.wait(timeout=30)
    print("[SYSTEM] Headless OAuth process finished.")

if __name__ == "__main__":
    main()
