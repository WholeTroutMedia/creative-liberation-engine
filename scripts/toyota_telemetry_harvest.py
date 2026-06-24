#!/usr/bin/env python3
"""
Sovereign Mobility Mesh: Toyota Venza Telemetry Harvester
Retrieves real-time hybrid vehicle telemetry, GPS coordinates, and diagnostic 
alerts using the Toyota Connected Services API, writing securely to the NAS memory spine.
"""

import os
import sys
import json
import logging
import asyncio
from datetime import datetime
from urllib.parse import urljoin, urlencode
import aiohttp
from toyota_na.client import ToyotaOneClient
from toyota_na.auth import ToyotaOneAuth

# Setup logging conforming to CLE V6 specifications
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] CLE-Venza: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(os.path.dirname(__file__), '../build.log'))
    ]
)

def get_resolved_path(unix_path):
    if os.name == 'nt':
        return unix_path.replace("/app/creative-liberation-engine/", "y:\\creative-liberation-engine\\").replace("/", "\\")
    return unix_path

STATE_FILE = get_resolved_path("/app/creative-liberation-engine/runtime/session/venza-state.json")
TOKENS_FILE = get_resolved_path("/app/creative-liberation-engine/runtime/session/toyota-tokens.json")

# TMNA Active Endpoints & Patches
API_GATEWAY = "https://onecdn.telematicsct.com/oneapi/"
USER_AGENT = "ToyotaOneApp/3.10.0 (com.toyota.oneapp; build:3100; Android 14) okhttp/4.12.0"
API_KEY = "Y1aVonEtOa18cDwNLGTjt1zqD7aLahwc30WvvvQE"

# ── CUSTOM AUTH PATCHES (Bypasses library check_tokens bug) ─────────────────
async def patched_check_tokens(self):
    if self._expires_at is None:
        raise NotLoggedIn()
    
    now = datetime.utcnow().timestamp()
    is_expired = self._expires_at < now
    
    # Force refresh if token is expired or if refresh interval is reached
    should_refresh = (
        is_expired or
        (self._refresh_secs > 0 and now > self._updated_at + self._refresh_secs) or
        (self._refresh_secs < 0 and now > self._expires_at + self._refresh_secs) or
        (self._refresh_secs == 0)
    )

    if should_refresh:
        try:
            logging.info("Toyota Auth: Token is expired or needs refresh. Triggering refresh_tokens()...")
            await self.refresh_tokens()
        except Exception as e:
            logging.error(f"Toyota Auth: Token refresh failed: {e}")
            if is_expired:
                raise TokenExpired()
            raise e

ToyotaOneAuth.check_tokens = patched_check_tokens

async def _auth_headers(self):
    return {
        "AUTHORIZATION": "Bearer " + await self.auth.get_access_token(),
        "X-API-KEY": self.API_KEY,
        "X-GUID": await self.auth.get_guid(),
        "X-CHANNEL": "ONEAPP",
        "X-BRAND": "T",
        "x-region": "US",
        "X-APPVERSION": "3.1.0",
        "X-LOCALE": "en-US",
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }

async def api_request(self, method, endpoint, header_params=None, **kwargs):
    headers = await self._auth_headers()
    if header_params:
        headers.update(header_params)

    if endpoint.startswith("/"):
        endpoint = endpoint[1:]

    url = urljoin(self.API_GATEWAY, endpoint)

    async with aiohttp.ClientSession() as session:
        async with session.request(
                method, url, headers=headers, **kwargs
        ) as resp:
            resp.raise_for_status()
            try:
                resp_json = await resp.json()
                if "payload" in resp_json:
                    return resp_json["payload"]
                return resp_json
            except:
                raise

# Apply patches to the loaded classes
ToyotaOneClient.API_GATEWAY = API_GATEWAY
ToyotaOneClient.API_KEY = API_KEY
ToyotaOneClient._auth_headers = _auth_headers
ToyotaOneClient.api_request = api_request
from toyota_na.exceptions import TokenExpired, NotLoggedIn


def load_credentials():
    """Load credentials from local environment configuration."""
    username = None
    password = None
    vin = None
    env_file = get_resolved_path("/app/creative-liberation-engine/.env")
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                if line.startswith("TOYOTA_USERNAME="):
                    username = line.split("=")[1].strip().strip('"').strip("'")
                elif line.startswith("TOYOTA_PASSWORD="):
                    password = line.split("=")[1].strip().strip('"').strip("'")
                elif line.startswith("TOYOTA_VIN="):
                    vin = line.split("=")[1].strip().strip('"').strip("'")
    return {
        "username": username or os.getenv("TOYOTA_USERNAME"),
        "password": password or os.getenv("TOYOTA_PASSWORD"),
        "vin": vin or os.getenv("TOYOTA_VIN")
    }

async def fetch_toyota_telemetry():
    """
    Query the active Toyota NA Connected Services API using saved session tokens.
    Automatically refreshes tokens and saves them back to disk.
    """
    creds = load_credentials()
    if not creds["vin"]:
        raise ValueError("TOYOTA_VIN not found in environment configuration.")

    if not os.path.exists(TOKENS_FILE):
        raise FileNotFoundError(f"Tokens file not found at {TOKENS_FILE}. Run toyota_setup_polling.py first.")

    with open(TOKENS_FILE, 'r') as f:
        tokens = json.load(f)

    # Setup self-updating token callback
    def save_tokens(updated_tokens):
        logging.info("Toyota Auth: Token refreshed. Saving updated token database...")
        with open(TOKENS_FILE, 'w') as f:
            json.dump(updated_tokens, f, indent=2)

    logging.info(f"Initializing connection to Toyota Connected Services for VIN: {creds['vin']}")
    auth = ToyotaOneAuth(callback=save_tokens, initial_tokens=tokens)
    client = ToyotaOneClient(auth=auth)

    # Fetch status endpoints
    status_payload = {}
    telemetry_payload = {}
    detail_payload = {}
    
    try:
        res = await client.get_vehicle_status(creds["vin"])
        if isinstance(res, dict):
            status_payload = res.get("payload", res)
        logging.info("Successfully fetched global remote status.")
    except Exception as e:
        logging.error(f"Failed to fetch vehicle remote status: {e}")

    try:
        res = await client.get_odometer_detail(creds["vin"])
        if isinstance(res, dict):
            telemetry_payload = res.get("payload", res)
        logging.info("Successfully fetched telemetry details via get_odometer_detail.")
    except Exception as e:
        logging.error(f"Failed to fetch telemetry: {e}")

    try:
        res = await client.get_vehicle_detail(creds["vin"])
        if isinstance(res, dict):
            detail_payload = res.get("payload", res)
        logging.info("Successfully fetched vehicle details.")
    except Exception as e:
        logging.error(f"Failed to fetch vehicle details: {e}")

    # Build response telemetry mapping
    # Safely extract values from API response with fallback
    telemetry = status_payload.get("telemetry", {})
    odo = telemetry.get("odo", {})
    fuel = telemetry.get("fugage", {})
    distance_empty = telemetry.get("rage", {})
    
    fl = telemetry_payload.get("flTirePressure", {})
    fr = telemetry_payload.get("frTirePressure", {})
    rl = telemetry_payload.get("rlTirePressure", {})
    rr = telemetry_payload.get("rrTirePressure", {})
    
    tire_pressures = {
        "front_left": float(fl.get("value")) if fl and fl.get("value") is not None else None,
        "front_right": float(fr.get("value")) if fr and fr.get("value") is not None else None,
        "rear_left": float(rl.get("value")) if rl and rl.get("value") is not None else None,
        "rear_right": float(rr.get("value")) if rr and rr.get("value") is not None else None
    }

    lat = status_payload.get("latitude")
    lon = status_payload.get("longitude")

    # Vehicle info details
    vehicle_info = detail_payload.get("vehicle", {})
    model_info = vehicle_info.get("model", {})
    color_info = vehicle_info.get("color", {})

    # Load existing state if it exists to preserve static fields
    existing_state = {}
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                existing_state = json.load(f)
        except Exception:
            pass

    # Map parsed API response conforming to our schema
    vehicle_telemetry = {
        "last_updated": datetime.now().isoformat() + "Z",
        "node_id": "venza_mobility_node",
        "device_class": "hybrid_vehicle",
        "registered": True,
        "mac_address": existing_state.get("mac_address", "b4:2c:88:e6:23:7e"),
        "ip_address": existing_state.get("ip_address"),
        "hostname": existing_state.get("hostname", "Toyota-Venza"),
        "mesh_status": existing_state.get("mesh_status", "DISCONNECTED"),
        "vehicle": {
            "model": model_info.get("displayName", "Toyota Venza Hybrid"),
            "model_year": model_info.get("modelYear", "2023"),
            "color": color_info.get("displayName", "Wind Chill Pearl"),
            "vin": creds["vin"],
            "status": "PARKED"
        },
        "telemetry": {
            "odometer_km": float(odo.get("value")) if odo and odo.get("value") is not None else None,
            "fuel_level_percent": float(fuel.get("value")) if fuel and fuel.get("value") is not None else None,
            "range_km": float(distance_empty.get("value")) if distance_empty and distance_empty.get("value") is not None else None,
            "tire_pressure_psi": tire_pressures,
            "hybrid_battery_soc": None  # Battery SoC is not reported in telematics payload
        },
        "location": {
            "latitude": float(lat) if lat is not None else None,
            "longitude": float(lon) if lon is not None else None,
            "heading": None,
            "speed_kph": 0.0
        },
        "diagnostics": {
            "malfunctions": [],
            "maintenance_required": False
        },
        "history": existing_state.get("history", [])
    }
    
    return vehicle_telemetry

# ── DYNAMIC GEOCODING, CALENDAR, AND GMAIL ENRICHMENT HELPERS ────────────────
from datetime import timedelta
import requests

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

def load_token_from_file(creds_path, is_personal=False, force_refresh=False):
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

def get_google_access_token(force_refresh=False):
    personal_path = get_resolved_path("/app/creative-liberation-engine/runtime/session/credentials/inquiries@creativeliberationengine.org.json")
    cortex_path = get_resolved_path("/app/creative-liberation-engine/runtime/session/credentials/inquiries@creativeliberationengine.org.json")
    
    token = load_token_from_file(personal_path, is_personal=True, force_refresh=force_refresh)
    if token:
        return token
        
    logging.info("Google Workspace Token: Falling back to CORTEX credentials...")
    return load_token_from_file(cortex_path, is_personal=False, force_refresh=force_refresh)

def reverse_geocode(lat, lon):
    if not lat or not lon:
        return None
    try:
        # Nominatim requires a descriptive user agent
        headers = {"User-Agent": "CLEEngine/1.0 (inquiries@creativeliberationengine.org)"}
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json"
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            display_name = data.get("display_name")
            if display_name:
                return display_name
        return f"Location ({lat:.5f}, {lon:.5f})"
    except Exception as e:
        logging.error(f"Reverse geocoding failed for {lat}, {lon}: {e}")
        return f"Location ({lat:.5f}, {lon:.5f})"

import re

barnstorm_schedules_cache = None

def fetch_all_barnstorm_schedules_imap():
    """Fetch and parse all Barnstorm wedding schedules via IMAP using App Password."""
    import imaplib
    import email
    from email.header import decode_header
    import re
    
    schedules = {}
    app_pwd = get_env_var("GMAIL_APP_PASSWORD")
    email_addr = get_env_var("ADMIN_EMAIL") or "inquiries@creativeliberationengine.org"
    if not app_pwd:
        return schedules
        
    try:
        logging.info("Connecting to Gmail IMAP to fetch Barnstorm schedules...")
        mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
        mail.login(email_addr, app_pwd)
        mail.select("inbox")
        
        status, data = mail.search(None, 'SUBJECT "Barnstorm Wedding"')
        if status != "OK":
            logging.error("IMAP search failed.")
            mail.logout()
            return schedules
            
        mail_ids = data[0].split()
        logging.info(f"Found {len(mail_ids)} potential Barnstorm Wedding emails via IMAP.")
        
        for mail_id in mail_ids:
            status, msg_data = mail.fetch(mail_id, "(BODY[HEADER.FIELDS (SUBJECT)])")
            if status != "OK":
                continue
            
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)
            subject_header = msg.get("Subject")
            if not subject_header:
                continue
                
            decoded_parts = decode_header(subject_header)
            subject = ""
            for part, encoding in decoded_parts:
                if isinstance(part, bytes):
                    subject += part.decode(encoding or "utf-8", errors="ignore")
                else:
                    subject += part
            
            subject_clean = subject.replace("Re:", "").replace("Fwd:", "").strip()
            parts = [p.strip() for p in subject_clean.split("-")]
            if len(parts) >= 2:
                date_part = parts[1]
                m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", date_part)
                event_date = None
                if m:
                    month, day, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
                    if year < 100:
                        year += 2000
                    event_date = f"{year:04d}-{month:02d}-{day:02d}"
                else:
                    m = re.search(r"(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})", date_part.lower())
                    if m:
                        months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
                        month = months.index(m.group(1)) + 1
                        day = int(m.group(2))
                        year = int(m.group(3))
                        event_date = f"{year:04d}-{month:02d}-{day:02d}"
                
                if event_date:
                    location = " - ".join(parts[2:]) if len(parts) >= 3 else "Unknown"
                    schedules[event_date] = {
                        "location": location,
                        "subject": subject_clean
                    }
        mail.logout()
        logging.info(f"Loaded {len(schedules)} unique Barnstorm wedding schedules via IMAP.")
        return schedules
    except Exception as e:
        logging.error(f"Failed to fetch Barnstorm schedules via IMAP: {e}")
        return schedules

def fetch_all_barnstorm_schedules(token):
    """Fetch and parse all Barnstorm wedding schedules from Gmail."""
    # Try IMAP first (robust and doesn't require active OAuth credentials)
    schedules = fetch_all_barnstorm_schedules_imap()
    if schedules:
        return schedules

    schedules = {}
    if not token:
        return schedules
    try:
        url = "https://www.googleapis.com/gmail/v1/users/me/messages"
        params = {
            "q": 'subject:"Barnstorm Wedding"',
            "maxResults": 100
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        if resp.status_code != 200:
            logging.error(f"Gmail API error while fetching schedules: {resp.text}")
            return schedules
            
        messages = resp.json().get("messages", [])
        for msg in messages:
            msg_id = msg.get("id")
            detail_url = f"https://www.googleapis.com/gmail/v1/users/me/messages/{msg_id}"
            detail_resp = requests.get(detail_url, headers=headers, timeout=10)
            if detail_resp.status_code == 200:
                msg_data = detail_resp.json()
                subject = ""
                for header in msg_data.get("payload", {}).get("headers", []):
                    if header.get("name") == "Subject":
                        subject = header.get("value")
                        break
                
                subject_clean = subject.replace("Re:", "").replace("Fwd:", "").strip()
                parts = [p.strip() for p in subject_clean.split("-")]
                if len(parts) >= 2:
                    date_part = parts[1]
                    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", date_part)
                    event_date = None
                    if m:
                        month, day, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
                        if year < 100:
                            year += 2000
                        event_date = f"{year:04d}-{month:02d}-{day:02d}"
                    else:
                        m = re.search(r"(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})", date_part.lower())
                        if m:
                            months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
                            month = months.index(m.group(1)) + 1
                            day = int(m.group(2))
                            year = int(m.group(3))
                            event_date = f"{year:04d}-{month:02d}-{day:02d}"
                    
                    if event_date:
                        location = " - ".join(parts[2:]) if len(parts) >= 3 else "Unknown"
                        schedules[event_date] = {
                            "location": location,
                            "subject": subject_clean
                        }
        logging.info(f"Loaded {len(schedules)} unique Barnstorm wedding schedules from Gmail.")
        return schedules
    except Exception as e:
        logging.error(f"Failed to fetch Barnstorm schedules from Gmail: {e}")
        return schedules

def get_barnstorm_schedule(token, date_str):
    """Get schedule for a specific date (YYYY-MM-DD) from cache, fetching if necessary."""
    global barnstorm_schedules_cache
    if barnstorm_schedules_cache is None:
        barnstorm_schedules_cache = fetch_all_barnstorm_schedules(token)
    return barnstorm_schedules_cache.get(date_str)

def check_location_match(address, location):
    if not address or not location:
        return False
    addr_words = set(re.findall(r"\w+", address.lower()))
    loc_words = set(re.findall(r"\w+", location.lower()))
    generic = {"ny", "nj", "de", "pa", "ct", "us", "usa", "state", "city", "street", "road", "ave", "avenue", "court", "ct", "way", "town", "county"}
    addr_words -= generic
    loc_words -= generic
    overlap = addr_words.intersection(loc_words)
    return len(overlap) > 0

def fetch_calendar_events(token, start_dt, end_dt):
    """Fetch calendar events overlapping the trip time window."""
    if not token:
        return []
    try:
        t_min = (start_dt - timedelta(minutes=30)).isoformat() + "Z"
        t_max = (end_dt + timedelta(minutes=30)).isoformat() + "Z"
        
        url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
        params = {
            "timeMin": t_min,
            "timeMax": t_max,
            "singleEvents": "true",
            "orderBy": "startTime"
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("items", [])
        else:
            logging.error(f"Google Calendar API returned status {resp.status_code}: {resp.text}")
            return []
    except Exception as e:
        logging.error(f"Failed to fetch Google Calendar events: {e}")
        return []

def fetch_gmail_context(token, start_dt, end_dt):
    """Fetch recent Gmail messages received/sent near the trip timeframe containing relevant keywords."""
    if not token:
        return []
    try:
        start_epoch = int((start_dt - timedelta(hours=2)).timestamp())
        end_epoch = int((end_dt + timedelta(hours=2)).timestamp())
        
        url = "https://www.googleapis.com/gmail/v1/users/me/messages"
        query = f"after:{start_epoch} before:{end_epoch} (meeting OR appointment OR reservation OR flight OR directions OR address OR schedule OR barnstorm OR cameron OR \"north fork sun\" OR jaymee)"
        params = {
            "q": query,
            "maxResults": 5
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        if resp.status_code == 200:
            messages = resp.json().get("messages", [])
            details = []
            for msg in messages:
                msg_id = msg.get("id")
                detail_url = f"https://www.googleapis.com/gmail/v1/users/me/messages/{msg_id}"
                detail_resp = requests.get(detail_url, headers=headers, timeout=10)
                if detail_resp.status_code == 200:
                    msg_data = detail_resp.json()
                    snippet = msg_data.get("snippet", "")
                    subject = ""
                    sender = ""
                    for header in msg_data.get("payload", {}).get("headers", []):
                        if header.get("name") == "Subject":
                            subject = header.get("value", "")
                        elif header.get("name") == "From":
                            sender = header.get("value", "")
                    details.append({"subject": subject, "snippet": snippet, "sender": sender})
            return details
        return []
    except Exception as e:
        logging.error(f"Failed to fetch Gmail context: {e}")
        return []

def classify_and_enrich_trip(start_lat, start_lon, end_lat, end_lon, start_time_str, end_time_str, distance_miles=None):
    # 1. Reverse Geocode addresses
    logging.info(f"Geocoding trip endpoints: ({start_lat}, {start_lon}) -> ({end_lat}, {end_lon})")
    start_address = reverse_geocode(start_lat, start_lon) or "Start Location"
    end_address = reverse_geocode(end_lat, end_lon) or "Destination"
    
    # 2. Parse times
    try:
        start_dt = datetime.strptime(start_time_str, "%Y-%m-%d %H:%M:%S")
        end_dt = datetime.strptime(end_time_str, "%Y-%m-%d %H:%M:%S")
    except Exception:
        try:
            start_dt = datetime.fromisoformat(start_time_str.replace("Z", ""))
            end_dt = datetime.fromisoformat(end_time_str.replace("Z", ""))
        except Exception as err:
            logging.error(f"Failed to parse datetime strings: {start_time_str}, {end_time_str}: {err}")
            return start_address, end_address, "UNASSIGNED", 100.0, "Automated trip logging."

    # 3. Query Google Calendar and Gmail
    token = get_google_access_token()
    
    # Calculate distance in miles if not provided
    if distance_miles is None:
        import math
        try:
            lat1, lon1, lat2, lon2 = map(float, [start_lat, start_lon, end_lat, end_lon])
            r = 3958.8 # Radius of Earth in miles
            phi1 = math.radians(lat1)
            phi2 = math.radians(lat2)
            d_phi = math.radians(lat2 - lat1)
            d_lon = math.radians(lon2 - lon1)
            a = math.sin(d_phi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(d_lon/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            distance_miles = r * c
        except Exception:
            distance_miles = 0.0
        
    # Check Barnstorm schedules from Gmail first (prioritize dates and places from email)
    trip_date_str = start_dt.strftime("%Y-%m-%d")
    sched = get_barnstorm_schedule(token, trip_date_str) if token else None
    
    # Check if there was a gig yesterday (for return trips)
    yesterday_dt = start_dt - timedelta(days=1)
    yesterday_str = yesterday_dt.strftime("%Y-%m-%d")
    prev_sched = get_barnstorm_schedule(token, yesterday_str) if token else None
    
    category = "UNASSIGNED"
    business_percentage = 100.0
    notes_list = []
    matched_event = None
    
    if sched and (check_location_match(start_address, sched["location"]) or check_location_match(end_address, sched["location"]) or distance_miles > 40):
        category = "BUSINESS"
        business_percentage = 100.0
        suffix = " (Outbound/Round-trip)" if not (check_location_match(start_address, sched["location"]) or check_location_match(end_address, sched["location"])) else ""
        notes_list.append(f"Barnstorm: {sched['subject']}{suffix}")
        matched_event = sched["subject"]
        logging.info(f"Matched trip on {trip_date_str} to Barnstorm schedule: {sched['subject']}")
    elif prev_sched and (check_location_match(start_address, prev_sched["location"]) or distance_miles > 40):
        category = "BUSINESS"
        business_percentage = 100.0
        notes_list.append(f"Barnstorm: {prev_sched['subject']} (Return Trip)")
        matched_event = prev_sched["subject"]
        logging.info(f"Matched trip on {trip_date_str} to Barnstorm yesterday schedule (return trip): {prev_sched['subject']}")
    else:
        calendar_events = fetch_calendar_events(token, start_dt, end_dt) if token else []
        gmail_emails = fetch_gmail_context(token, start_dt, end_dt) if token else []
        
        # 4. Classify based on calendar
        if calendar_events:
            for event in calendar_events:
                summary = event.get("summary", "").lower()
                location = event.get("location", "").lower()
                description = event.get("description", "").lower()
                
                is_barnstorm = "barnstorm" in summary or "cameron" in summary
                is_nfs = "north fork sun" in summary or "jaymee" in summary
                
                personal_keywords = ["dentist", "doctor", "personal", "lunch with", "dinner with", "vacation", "holiday", "workout", "gym", "birthday", "bday", "anniversary", "party", "family", "brunch", "dinner", "lunch", "breakfast"]
                is_personal = any(kw in summary or kw in description for kw in personal_keywords)
                
                if is_personal and not (is_barnstorm or is_nfs):
                    category = "PERSONAL"
                    business_percentage = 0.0
                else:
                    category = "BUSINESS"
                    business_percentage = 100.0
                
                matched_event = event.get("summary", "Scheduled Event")
                if is_barnstorm:
                    notes_list.append(f"Barnstorm: {event.get('summary')}")
                elif is_nfs:
                    notes_list.append(f"North Fork Sun: {event.get('summary')}")
                else:
                    notes_list.append(f"Calendar: {event.get('summary')}")
                    
                if event.get("location"):
                    notes_list.append(f"Event Location: {event.get('location')}")
                break
                
        # 5. Classify based on Gmail (only match specific Barnstorm emails from Cameron/booking)
        if not matched_event and gmail_emails:
            for email in gmail_emails:
                subject = email.get("subject", "").lower()
                snippet = email.get("snippet", "").lower()
                sender = email.get("sender", "").lower()
                
                is_barnstorm = (
                    "cameron" in sender or 
                    "mitchell" in sender or 
                    "barnstorm" in subject or 
                    "barnstorm" in snippet
                )
                
                if is_barnstorm:
                    category = "BUSINESS"
                    business_percentage = 100.0
                    notes_list.append(f"Barnstorm: {email.get('subject')} | From: {email.get('sender')}")
                    break

    # Build final notes string
    if notes_list:
        notes = " | ".join(notes_list)
    else:
        # Check if start or destination is Home (Jamesport, NY or White Birch Court)
        is_home_start = any(k in start_address for k in ["White Birch Court", "Jamesport", "Jamesport Commons"])
        is_home_end = any(k in end_address for k in ["White Birch Court", "Jamesport", "Jamesport Commons"])
        
        # Check for North Fork towns for NFS approximation (exact component match)
        is_nf_town = False
        nf_towns = ["Mattituck", "Cutchogue", "Southold", "Greenport", "Laurel", "Peconic", "Orient"]
        for addr in [start_address, end_address]:
            if addr:
                components = [c.strip().lower() for c in addr.split(",")]
                if any(town.lower() in components for town in nf_towns):
                    is_nf_town = True
                    break
        
        if is_home_start and is_home_end:
            notes = "Local loop around home."
            category = "PERSONAL"
            business_percentage = 0.0
        elif (is_home_start or is_home_end) and is_nf_town:
            # One endpoint is home and the other is a North Fork town - approximate as North Fork Sun!
            category = "BUSINESS"
            business_percentage = 100.0
            notes = "North Fork Sun: Approximated by North Fork destination."
        else:
            notes = "Automated mileage log. No calendar event matched."
            
    return start_address, end_address, category, business_percentage, notes

import sqlite3

def log_telemetry_to_db(data, existing_state):
    db_path = get_resolved_path("/app/creative-liberation-engine/runtime/db/ledger.db")
    if not os.path.exists(db_path):
        logging.warning(f"Database not found at {db_path}, skipping DB log.")
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 1. Insert snapshot
        t = data.get("telemetry", {})
        tires = t.get("tire_pressure_psi", {})
        loc = data.get("location", {})
        vin = data.get("vehicle", {}).get("vin", "JTEAAAAH9PJ121928")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute("""
            INSERT INTO vehicle_snapshots (vin, timestamp, odometer, fuel_percent, range_miles,
                lat, lon, tire_fl, tire_fr, tire_rl, tire_rr)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            vin,
            timestamp,
            t.get("odometer_km"),
            t.get("fuel_level_percent"),
            t.get("range_km"),
            loc.get("latitude"),
            loc.get("longitude"),
            tires.get("front_left"),
            tires.get("front_right"),
            tires.get("rear_left"),
            tires.get("rear_right")
        ))
        logging.info("Logged new vehicle snapshot to database.")

        snapshot_id = cursor.lastrowid
        refuel_detected = False
        refuel_cost = 0.0
        refuel_id = None

        # 1.5. Check for refueling event in real-time
        if existing_state:
            old_t = existing_state.get("telemetry", {})
            old_fuel = old_t.get("fuel_level_percent")
            new_fuel = t.get("fuel_level_percent")

            if old_fuel is not None and new_fuel is not None and new_fuel > old_fuel + 15.0:
                logging.info(f"Real-time refueling detected: {old_fuel}% -> {new_fuel}%")
                refuel_detected = True
                
                fuel_diff = new_fuel - old_fuel
                gallons_added = (fuel_diff / 100.0) * 14.5
                
                lat = loc.get("latitude")
                lon = loc.get("longitude")
                address = reverse_geocode(lat, lon) or "Unknown Location"
                
                # Query Overpass API for nearest station name and estimate cash price
                try:
                    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
                    import detect_refuelings
                    station_name = detect_refuelings.find_closest_gas_station(lat, lon)
                    price = detect_refuelings.estimate_cash_price(address)
                except Exception as imp_err:
                    logging.error(f"Failed to import detect_refuelings helper: {imp_err}")
                    station_name = "Unknown Gas Station"
                    addr_lower = address.lower()
                    if "new jersey" in addr_lower or ", nj" in addr_lower:
                        price = 4.00
                    else:
                        price = 4.26
                        
                refuel_cost = gallons_added * price
                
                cursor.execute("""
                    INSERT INTO refuelings (snapshot_id, timestamp, odometer, prev_fuel, curr_fuel,
                        fuel_added_percent, gallons_added, lat, lon, station_name, price_per_gallon, estimated_cost)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    snapshot_id,
                    timestamp,
                    t.get("odometer_km"),
                    old_fuel,
                    new_fuel,
                    fuel_diff,
                    gallons_added,
                    lat,
                    lon,
                    station_name,
                    price,
                    refuel_cost
                ))
                refuel_id = cursor.lastrowid
                logging.info(f"Refuel event logged to database (ID: {refuel_id})")

        # 2. Check for odometer delta to record a trip
        if existing_state:
            old_t = existing_state.get("telemetry", {})
            old_odo = old_t.get("odometer_km")
            new_odo = t.get("odometer_km")

            if old_odo and new_odo and new_odo > old_odo:
                delta = new_odo - old_odo
                logging.info(f"Odometer delta detected: {old_odo} -> {new_odo} (+{delta:.1f} mi). Logging automated trip.")
                
                old_loc = existing_state.get("location", {})
                start_lat = old_loc.get("latitude")
                start_lon = old_loc.get("longitude")
                end_lat = loc.get("latitude")
                end_lon = loc.get("longitude")

                start_time = existing_state.get("last_updated", datetime.now().isoformat())[:19].replace('T', ' ')
                end_time = timestamp

                # Dynamic geocoding, Google Calendar, and Gmail context mapping
                start_address, end_address, category, business_pct, notes = classify_and_enrich_trip(
                    start_lat, start_lon, end_lat, end_lon, start_time, end_time, delta
                )

                cursor.execute("""
                    INSERT INTO trips (vin, start_time, end_time, start_odo, end_odo,
                        start_lat, start_lon, end_lat, end_lon,
                        start_address, end_address, category, business_percentage, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    vin,
                    start_time,
                    end_time,
                    old_odo,
                    new_odo,
                    start_lat,
                    start_lon,
                    end_lat,
                    end_lon,
                    start_address,
                    end_address,
                    category,
                    business_pct,
                    notes
                ))
                trip_id = cursor.lastrowid
                logging.info("Automated trip recorded successfully in database.")

                # Link refuel to this trip if we just detected one
                if refuel_detected and refuel_id:
                    cursor.execute(
                        "UPDATE refuelings SET trip_id = ? WHERE refueling_id = ?",
                        (trip_id, refuel_id)
                    )
                    cursor.execute(
                        "UPDATE trips SET fuel_cost = ? WHERE trip_id = ?",
                        (refuel_cost, trip_id)
                    )
                    logging.info(f"Linked real-time refueling {refuel_id} to current Trip ID {trip_id}")

        # If refueling was detected but no new trip was recorded in this snapshot:
        if refuel_detected and refuel_id and (not (old_odo and new_odo and new_odo > old_odo)):
            # Find the most recent trip
            cursor.execute("SELECT trip_id, end_odo FROM trips ORDER BY end_time DESC LIMIT 1")
            recent_trip = cursor.fetchone()
            if recent_trip:
                recent_trip_id, recent_end_odo = recent_trip
                curr_odo = t.get("odometer_km")
                if curr_odo and abs(curr_odo - recent_end_odo) <= 2.5:
                    cursor.execute(
                        "UPDATE refuelings SET trip_id = ? WHERE refueling_id = ?",
                        (recent_trip_id, refuel_id)
                    )
                    cursor.execute(
                        "UPDATE trips SET fuel_cost = ? WHERE trip_id = ?",
                        (refuel_cost, recent_trip_id)
                    )
                    logging.info(f"Linked real-time refueling {refuel_id} to last recent Trip ID {recent_trip_id} (odo match)")

        conn.commit()
        conn.close()
        
        try:
            import allocate_fuel_costs
            allocate_fuel_costs.allocate()
        except Exception as ae:
            logging.error(f"Failed to trigger fuel cost allocation: {ae}")
    except Exception as e:
        logging.error(f"Failed to log telemetry or trip to SQLite database: {str(e)}")

def save_state(data):
    """Persist vehicle telemetry into the Creative Liberation Engine runtime state."""
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    try:
        with open(STATE_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        logging.info(f"Successfully serialized telemetry state to {STATE_FILE}")
    except Exception as e:
        logging.error(f"Failed to write telemetry state: {str(e)}")

def log_telemetry_to_sheets(data):
    """Post vehicle telemetry directly to Google Sheets using resolved credentials."""
    import requests
    from datetime import datetime
    
    token = get_google_access_token()
    if not token:
        logging.error("Google Workspace token could not be loaded for direct telemetry logging.")
        return
        
    try:
        sheet_id = "1S309ogUDTbFkZKMWpdFI2ABd5iaerHF8AtG_zq0b-Dg"
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/Sheet1!A:F:append?valueInputOption=USER_ENTERED"
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        }
        
        t = data.get("telemetry", {})
        loc = data.get("location", {})
        
        timestamp_str = datetime.now().isoformat()
        
        odo_val = t.get("odometer_km")
        fuel_val = t.get("fuel_level_percent")
        range_val = t.get("range_km")
        lat = loc.get("latitude")
        lon = loc.get("longitude")
        
        fuel_str = f"Fuel: {fuel_val}%" if fuel_val is not None else "Fuel: N/A"
        odo_str = f"Odometer: {odo_val} mi" if odo_val is not None else "Odometer: N/A"
        range_str = f"Range: {range_val} mi" if range_val is not None else "Range: N/A"
        gps_str = f"GPS: {lat}, {lon}" if lat is not None and lon is not None else "GPS: N/A"
        
        rows = [[
            timestamp_str,
            "Toyota Venza OBD-II (Live Telemetry)",
            fuel_str,
            odo_str,
            range_str,
            gps_str
        ]]
        
        payload = {
            "values": rows
        }
        
        logging.info("Appending telemetry row directly to Google Sheets...")
        response = requests.post(url, headers=headers, json=payload, timeout=20)
        
        if response.status_code == 200:
            logging.info("Successfully logged telemetry directly to Google Sheets!")
        else:
            logging.warning(f"Google Sheets direct log returned status {response.status_code}: {response.text}")
    except Exception as e:
        logging.error(f"Failed to log telemetry directly to Google Sheets: {str(e)}")

async def main():
    logging.info("Venza Telemetry Harvester active.")
    try:
        # Load existing state first to preserve/compare values
        existing_state = {}
        if os.path.exists(STATE_FILE):
            try:
                with open(STATE_FILE, 'r') as f:
                    existing_state = json.load(f)
            except Exception:
                pass

        data = await fetch_toyota_telemetry()
        
        # Log database actions prior to state overwrite
        log_telemetry_to_db(data, existing_state)
        
        save_state(data)
        log_telemetry_to_sheets(data)

        # Trigger Google Sheets Mileage Ledger bidirectional sync
        try:
            import subprocess
            sync_script = get_resolved_path("/app/creative-liberation-engine/scripts/sync_toyota_google_sheets.py")
            logging.info("Triggering Google Sheets Mileage Ledger bidirectional sync...")
            subprocess.Popen([sys.executable, sync_script])
        except Exception as sync_err:
            logging.error(f"Failed to trigger Google Sheets sync: {sync_err}")

    except Exception as e:
        logging.error(f"Critical execution failure in Venza collector: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())

