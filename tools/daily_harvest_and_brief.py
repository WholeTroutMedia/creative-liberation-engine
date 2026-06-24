#!/usr/bin/env python3
"""
Creative Liberation Engine V6: Daily Clippings Ingestion and Morning Brief Builder (NAS Server-Side)
This script runs entirely server-side on the NAS to:
1. Authenticate with Google API using Cortex's sovereign credentials.
2. Scan the Google Drive folder 'Clippings and Screenshots' via Drive API.
3. Download and analyze new Threads clippings using the Gemini API.
4. Update the RAG markdown/JSON files in media_intake.
5. Rebuild the local CPU RAG database.
6. Update the morning brief html with new ideations.
"""

import os
import sys
import json
import urllib.request
import urllib.parse
import urllib.error
import base64
from datetime import datetime

# API Binding
GEMINI_API_KEY = "AIzaSyDJIwtD-WLPp-rexDkdA_uQPnOi2BGNSfw"
DRIVE_FOLDER_ID = "17zjGjWTF0a60L9eaO3oO44npGy5Ak-d4"

# Relative Path Resolution
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CREDENTIALS_FILE = os.path.join(WORKSPACE_ROOT, "media_intake", "cortex_google_credentials.json")
MANIFEST_FILE = os.path.join(WORKSPACE_ROOT, "media_intake", "clippings_manifest.json")
RAG_MD_FILE = os.path.join(WORKSPACE_ROOT, "media_intake", "Resolve_RAG_Data", "Learning", "clippings_harvest_learning.md")
RAG_JSON_FILE = os.path.join(WORKSPACE_ROOT, "media_intake", "Sovereign_Academy_RAG", "Learning", "clippings_20260604_chains.json")
DAILY_BRIEF_FILE = os.path.join(WORKSPACE_ROOT, "media_intake", "live_daily_brief.html")

def get_access_token():
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"[!] Credentials file not found: {CREDENTIALS_FILE}")
        return None
    try:
        with open(CREDENTIALS_FILE, 'r', encoding='utf-8') as f:
            creds = json.load(f)
        
        url = creds.get("token_uri", "https://oauth2.googleapis.com/token")
        payload = {
            "client_id": creds["client_id"],
            "client_secret": creds["client_secret"],
            "refresh_token": creds["refresh_token"],
            "grant_type": "refresh_token"
        }
        data = urllib.parse.urlencode(payload).encode('utf-8')
        req = urllib.request.Request(
            url, 
            data=data, 
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode('utf-8'))
            return res['access_token']
    except urllib.error.HTTPError as e:
        print(f"[!] HTTP Error during Google token refresh: {e.code} {e.reason}")
        try:
            print("Response body:", e.read().decode('utf-8'))
        except Exception:
            pass
        return None
    except Exception as e:
        print(f"[!] Failed to refresh Google access token: {e}")
        return None

def list_drive_files(access_token):
    print(f"[*] Listing files in Google Drive folder: {DRIVE_FOLDER_ID}...")
    try:
        query = f"'{DRIVE_FOLDER_ID}' in parents and trashed = false"
        url = f"https://www.googleapis.com/drive/v3/files?q={urllib.parse.quote(query)}&fields=files(id,name,mimeType,createdTime)"
        req = urllib.request.Request(url)
        req.add_header('Authorization', f'Bearer {access_token}')
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode('utf-8'))
            return res.get('files', [])
    except Exception as e:
        print(f"[!] Failed to query Google Drive: {e}")
        return []

def download_drive_file(access_token, file_id):
    try:
        url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
        req = urllib.request.Request(url)
        req.add_header('Authorization', f'Bearer {access_token}')
        with urllib.request.urlopen(req) as response:
            return response.read()
    except Exception as e:
        print(f"[!] Failed to download file {file_id}: {e}")
        return None

def call_gemini_vision(image_bytes, mime_type):
    try:
        img_b64 = base64.b64encode(image_bytes).decode('utf-8')
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        
        prompt = """
        You are the Creative Liberation Engine's Creative Director AI. Analyze this Threads screenshot and extract the following details.
        
        Respond with EXACTLY a JSON block (do not enclose in markdown blocks, just raw JSON) using this format:
        {
          "creator": "username or creator handle if visible, otherwise unknown",
          "concept": "Short descriptive name of the design/tech concept",
          "learning": "Detailed paragraph explaining the key technical or design learning from the post.",
          "queries": "Comma-separated list of similar queries, references, or tools related to this concept"
        }
        """
        
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": img_b64
                        }
                    }
                ]
            }],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        
        req = urllib.request.Request(
            url, 
            data=json.dumps(payload).encode('utf-8'), 
            headers={'Content-Type': 'application/json'}
        )
        
        with urllib.request.urlopen(req) as response:
            res_json = json.loads(response.read().decode('utf-8'))
            text_response = res_json['candidates'][0]['content']['parts'][0]['text']
            return json.loads(text_response.strip())
    except Exception as e:
        print(f"[!] Failed to analyze image via Gemini: {e}")
        return None

def update_rag_files(filename, info):
    # 1. Update clippings_harvest_learning.md
    if os.path.exists(RAG_MD_FILE):
        try:
            with open(RAG_MD_FILE, 'r', encoding='utf-8') as f:
                content = f.read()
            
            import re
            concepts = re.findall(r'## Ingested Concept (\d+):', content)
            next_num = max([int(n) for n in concepts]) + 1 if concepts else 12
            
            md_entry = f"\n\n## Ingested Concept {next_num}: {info['concept']}\n"
            md_entry += f"* **Context:** Harvested from Threads creator @{info['creator']} (File: {filename})\n"
            md_entry += f"* **Key Learning:** {info['learning']}\n"
            md_entry += f"* **Sovereign System Integration:** Search queries: {info['queries']}\n"
            
            with open(RAG_MD_FILE, 'a', encoding='utf-8') as f:
                f.write(md_entry)
            print(f"[+] Appended MD concept {next_num} to RAG docs.")
        except Exception as e:
            print(f"[!] Error updating RAG markdown file: {e}")

    # 2. Update clippings_20260604_chains.json
    if os.path.exists(RAG_JSON_FILE):
        try:
            with open(RAG_JSON_FILE, 'r', encoding='utf-8') as f:
                chains = json.load(f)
            
            new_chain = {
                "problem": f"Integrating and optimizing the creative design/technical concept: {info['concept']}",
                "approach_a": "Static or ad-hoc custom manual coding without standardized design tokens or templates.",
                "approach_b": f"Adopting the specific workflow: {info['learning']}",
                "solution": f"Inject custom workspace configs utilizing references: {info['queries']}"
            }
            chains.append(new_chain)
            
            with open(RAG_JSON_FILE, 'w', encoding='utf-8') as f:
                json.dump(chains, f, indent=2)
            print("[+] Appended reasoning chain to RAG JSON.")
        except Exception as e:
            print(f"[!] Error updating RAG JSON file: {e}")

def rebuild_rag_db():
    print("[*] Rebuilding local CPU RAG database...")
    # Since we are running on the NAS directly, we can call build_cpu_rag.py directly
    build_script = os.path.join(WORKSPACE_ROOT, "tools", "build_cpu_rag.py")
    
    # Clean the database directory first
    db_dir = os.path.join(WORKSPACE_ROOT, "media_intake", "chroma_db_cpu")
    import shutil
    if os.path.exists(db_dir):
        shutil.rmtree(db_dir)
        
    import subprocess
    cmd = [sys.executable, build_script]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            print("[+] NAS RAG index rebuilt successfully.")
            print(res.stdout)
        else:
            print(f"[!] RAG rebuild script failed. Stderr: {res.stderr}")
    except Exception as e:
        print(f"[!] Error executing RAG rebuild script: {e}")

def update_morning_brief(new_clippings):
    if not os.path.exists(DAILY_BRIEF_FILE):
        print(f"[!] Daily brief template not found at {DAILY_BRIEF_FILE}.")
        return
    
    try:
        with open(DAILY_BRIEF_FILE, 'r', encoding='utf-8') as f:
            html = f.read()
        
        clippings_html = ""
        for fname, info in new_clippings.items():
            clippings_html += f"""
            <tr style="border-bottom: 1px solid #232838;">
              <td width="20%" style="padding: 10px 0; font-weight: bold; color: #FF3366; font-family: 'Courier New', Courier, monospace;">@{info['creator']}</td>
              <td style="padding: 10px 0; font-size: 13px;">
                <strong style="color: #FFFFFF;">{info['concept']}</strong>: {info['learning']}<br>
                <span style="font-size: 11px; color: #8F9CAE; font-family: 'Courier New', Courier, monospace;">Refs: {info['queries']} (Source: {fname})</span>
              </td>
            </tr>
            """

        new_section = f"""
              <!-- CLIPPINGS SECTION -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 35px;">
                <tr>
                  <td style="border-left: 3px solid #FF3366; padding-left: 12px; margin-bottom: 15px;">
                    <span style="font-size: 11px; color: #FF3366; font-family: 'Courier New', Courier, monospace; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">⚡ Daily Threads Ingestions</span>
                    <h2 style="margin: 0; font-size: 18px; color: #FFFFFF; font-weight: 800;">🎨 RECENT SCREENSHOT HARVESTS</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 15px;">
                    <div style="background-color: #171A24; border: 1px solid #282D3D; border-radius: 6px; padding: 20px;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="line-height: 1.6; color: #E2E8F0;">
                        {clippings_html}
                      </table>
                    </div>
                  </td>
                </tr>
              </table>
        """

        # Ingest before workspace block
        insertion_target = "<!-- IV. GENERAL USER WORKSPACE -->"
        if insertion_target in html:
            # Avoid duplicating the section if it is already there
            if "RECENT SCREENSHOT HARVESTS" in html:
                # Replace the old section
                import re
                html = re.sub(r'<!-- CLIPPINGS SECTION -->.*?</table>\s*(?=\s*<!-- IV. GENERAL USER WORKSPACE -->)', '', html, flags=re.DOTALL)
            html = html.replace(insertion_target, f"{new_section}\n\n              {insertion_target}")
            print("[+] Injected/Updated clippings section in morning brief HTML.")
        
        # Update brief timestamp
        now_str = datetime.now().strftime("%Y-%m-%d // %H:%M Local")
        import re
        html = re.sub(r'\d{4}-\d{2}-\d{2} // \d{2}:\d{2} Local', now_str, html)
        
        with open(DAILY_BRIEF_FILE, 'w', encoding='utf-8') as f:
            f.write(html)
        print("[+] Daily brief HTML updated successfully on the NAS.")
            
    except Exception as e:
        print(f"[!] Error updating daily brief HTML: {e}")

def main():
    print(f"=====================================================")
    print(f" CLE ENGINE V6: SERVER-SIDE SCREENSHOT HARVEST  ")
    print(f"=====================================================")
    print(f"[*] Timestamp: {datetime.now().isoformat()}")
    
    # 1. Load oauth2 token
    access_token = get_access_token()
    if not access_token:
        print("[!] Aborting: Could not get Google API Access Token.")
        sys.exit(1)
        
    # 2. Load manifest
    if not os.path.exists(MANIFEST_FILE):
        print("[!] Manifest file not found. Run manifest initialization first.")
        sys.exit(1)
        
    with open(MANIFEST_FILE, 'r', encoding='utf-8') as f:
        manifest_data = json.load(f)
    processed = manifest_data.get("processed_files", {})
    
    # 3. Query Google Drive API
    files = list_drive_files(access_token)
    print(f"[*] Found {len(files)} files in GDrive folder.")
    
    newly_processed = {}
    
    for f in files:
        file_name = f['name']
        file_id = f['id']
        mime_type = f['mimeType']
        
        # Skip if already processed
        if file_name in processed:
            continue
            
        # Only process images
        if not mime_type.startswith("image/"):
            print(f"[*] Skipping non-image file: {file_name}")
            continue
            
        print(f"[*] Ingesting new file: {file_name} (ID: {file_id})...")
        image_bytes = download_drive_file(access_token, file_id)
        if not image_bytes:
            continue
            
        info = call_gemini_vision(image_bytes, mime_type)
        if info:
            print(f"  [+] Harvested concept: {info['concept']} by @{info['creator']}")
            newly_processed[file_name] = info
            processed[file_name] = info
            # Update RAG storage
            update_rag_files(file_name, info)
            
    if newly_processed:
        # Save manifest
        with open(MANIFEST_FILE, 'w', encoding='utf-8') as f:
            json.dump({"processed_files": processed}, f, indent=2)
            
        # Trigger local RAG database rebuild
        rebuild_rag_db()
        
        # Update daily brief HTML
        update_morning_brief(newly_processed)
        
        print("\n=====================================================")
        print("[+] Daily ingest sequence completed successfully.")
        print("=====================================================")
    else:
        print("[*] No new clippings to ingest today.")
        update_morning_brief({})

if __name__ == "__main__":
    main()
