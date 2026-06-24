#!/usr/bin/env python3
"""
Creative Liberation Engine V6: Patreon Harvester

This script utilizes yt-dlp authenticated with a cookies.txt file to autonomously 
fetch high-quality premium media from Patreon. It bypasses the UI completely.
The videos are staged for Taste Ledger analysis, while subtitles, descriptions, 
and attachments are extracted for the RAG database.
"""

import os
import argparse
import asyncio
import json
import re
import requests
import glob
from datetime import datetime, timezone

try:
    import yt_dlp
except ImportError:
    print("[!] Missing yt-dlp library. Install via: pip install yt-dlp")
    exit(1)

import sys

def get_nas_path(win_path):
    if sys.platform.startswith("win"):
        return win_path
    local_path = win_path.replace(r"\\127.0.0.1\docker", "/app")
    return local_path.replace("\\", "/")

NAS_STAGING = get_nas_path(r"\\127.0.0.1\docker\creative-liberation-engine\media_intake\staging")
NAS_RAG_DATA = get_nas_path(r"\\127.0.0.1\docker\creative-liberation-engine\media_intake\Resolve_RAG_Data\Patreon")

def ensure_directories():
    print(f"[*] Verifying NAS target directories...")
    os.makedirs(NAS_STAGING, exist_ok=True)
    os.makedirs(NAS_RAG_DATA, exist_ok=True)


def parse_cookies_txt(filename):
    """Parse Netscape format cookies.txt into a Python dict for requests."""
    cookies = {}
    if not os.path.exists(filename):
        return cookies
    try:
        with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                if not line.startswith('#') and line.strip():
                    parts = line.strip().split('\t')
                    if len(parts) >= 7:
                        cookies[parts[5]] = parts[6]
    except Exception as e:
        print(f"[!] Error parsing cookies.txt: {e}")
    return cookies

def extract_text_from_prosemirror(json_str):
    """Convert Patreon Prosemirror JSON string to clean text."""
    if not json_str:
        return ""
    try:
        doc = json.loads(json_str)
        text_parts = []
        def traverse(node):
            if isinstance(node, dict):
                is_block = node.get("type") in ("paragraph", "heading", "bullet_list", "ordered_list", "list_item")
                if is_block and text_parts and text_parts[-1] != "\n":
                    text_parts.append("\n")
                if node.get("type") == "text" and "text" in node:
                    text_parts.append(node["text"])
                for val in node.values():
                    traverse(val)
            elif isinstance(node, list):
                for item in node:
                    traverse(item)
        traverse(doc)
        return "".join(text_parts).strip()
    except Exception:
        return ""

def process_text_content(text_content, post_title, post_id):
    """Ingest text content directly into the RAG database."""
    if not text_content or len(text_content.strip()) < 10:
        return None
        
    safe_title = re.sub(r'[^\w\-]', '_', post_title.lower())
    filename = f"patreon_{post_id}_{safe_title}.description"
    filepath = os.path.join(NAS_STAGING, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text_content)
        
    print(f"[*] Processing description: {filepath}")
    try:
        import reasoning_structurizer
        structured_data = reasoning_structurizer.structurize_text_to_reasoning_chains(text_content)
        
        target_json_path = os.path.join(NAS_RAG_DATA, f"{filename}_chains.json")
        reasoning_structurizer.save_structured_data(structured_data, target_json_path)
        print(f"[+] Knowledge extraction complete. JSON saved to {target_json_path}")
        return target_json_path
    except Exception as e:
        print(f"[!] Error processing text asset: {e}")
        return None
def fetch_campaign_entries(url, cookies, headers):
    """
    Fetches campaign post entries directly via Patreon web and API.
    Bypasses yt-dlp flat extraction to avoid Cloudflare blocks.
    Returns a list of dicts with keys: 'url', 'title', 'id'.
    """
    print("[*] Resolving campaign page via requests...")
    try:
        resp = requests.get(url, headers=headers, cookies=cookies, timeout=15)
        if resp.status_code != 200:
            print(f"[!] Failed to fetch campaign page: status {resp.status_code}")
            return []
            
        # Parse campaign ID
        match = re.search(r'"campaign":\s*\{\s*"data":\s*\{\s*"id":\s*"(\d+)"', resp.text)
        campaign_id = None
        if match:
            campaign_id = match.group(1)
        else:
            match2 = re.search(r'"campaign_id":\s*(\d+)', resp.text)
            if match2:
                campaign_id = match2.group(1)
            else:
                match3 = re.search(r'/campaigns/(\d+)', resp.text)
                if match3:
                    campaign_id = match3.group(1)
                    
        if not campaign_id:
            print("[!] Could not parse campaign ID from page HTML.")
            return []
            
        print(f"[+] Found Campaign ID: {campaign_id}")
        
        # Paginate through campaign posts
        entries = []
        api_url = f"https://www.patreon.com/api/posts?filter[campaign_id]={campaign_id}&page[size]=20"
        
        while api_url:
            print(f"[*] Fetching posts page from API: {api_url}")
            api_resp = requests.get(api_url, headers=headers, cookies=cookies, timeout=15)
            if api_resp.status_code != 200:
                print(f"[!] Failed to fetch API page: status {api_resp.status_code}")
                break
                
            data = api_resp.json()
            posts = data.get('data', [])
            if not posts:
                break
                
            for post in posts:
                post_id = post.get('id')
                attrs = post.get('attributes', {})
                post_title = attrs.get('title') or f"Post_{post_id}"
                post_url = attrs.get('url')
                if post_url and not post_url.startswith('http'):
                    post_url = "https://www.patreon.com" + post_url
                elif not post_url:
                    post_url = f"https://www.patreon.com/posts/{post_id}"
                    
                entries.append({
                    "id": post_id,
                    "url": post_url,
                    "title": post_title
                })
                
            links = data.get('links', {})
            api_url = links.get('next')
            
        print(f"[+] Successfully retrieved {len(entries)} posts via Patreon API.")
        return entries
        
    except Exception as e:
        print(f"[!] Error fetching campaign posts: {e}")
        return []

async def run_harvester(url, cookies_file="cookies.txt", playlist_items=None, download_media=False):
    print("=====================================================")
    print(" V6 SOVEREIGN MEDIA MESH - PATREON HARVESTER SWARM   ")
    print("=====================================================")
    ensure_directories()
    
    if not os.path.exists(cookies_file):
        print(f"[!] Critical Error: Cookies file '{cookies_file}' not found.")
        return

    print(f"[*] Target URL: {url}")
    print(f"[*] Authenticating via: {cookies_file}")
    print(f"[*] Download Media setting: {download_media}")
    
    cookies = parse_cookies_txt(cookies_file)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0"
    }
    
    # Step 1: Extract campaign playlist flat entries using direct API fetcher
    print("[*] Retrieving Patreon campaign entries...")
    entries = fetch_campaign_entries(url, cookies, headers)
    if not entries:
        print("[!] No campaign entries could be retrieved.")
        return
        
    if playlist_items:
        try:
            if '-' in playlist_items:
                start_s, end_s = playlist_items.split('-')
                start_idx = max(0, int(start_s) - 1)
                end_idx = int(end_s)
                entries = entries[start_idx:end_idx]
            else:
                limit_val = int(playlist_items)
                entries = entries[:limit_val]
            print(f"[*] Applied limit filter: processing {len(entries)} entries.")
        except Exception as e:
            print(f"[!] Warning: Could not parse limit filter '{playlist_items}': {e}")

    # Step 2: Process each post
    for index, entry in enumerate(entries):
        if not entry:
            continue
        entry_url = entry.get('url', '')
        print(f"\n[*] Processing item {index+1}/{len(entries)}: {entry_url}")
        
        # Extract post ID
        match = re.search(r'(\d+)$', entry_url)
        if not match:
            print(f"  [!] Could not extract post ID from URL: {entry_url}")
            continue
        post_id = match.group(1)
        canonical_post_url = f"https://www.patreon.com/posts/{post_id}"
        
        post_title = entry.get('title') or f"Post_{post_id}"
        print(f"  [*] Title: {post_title}")
        
        # Step 2a: Harvest text content and attachments from Patreon API
        text_content = ""
        attachments = []
        try:
            api_url = f"https://www.patreon.com/api/posts/{post_id}"
            resp = requests.get(api_url, headers=headers, cookies=cookies, timeout=10)
            if resp.status_code == 200:
                post_data = resp.json()
                attributes = post_data.get('data', {}).get('attributes', {})
                post_title = attributes.get('title') or post_title
                
                # Extract description
                json_str = attributes.get('content_json_string')
                if json_str:
                    text_content = extract_text_from_prosemirror(json_str)
                else:
                    text_content = attributes.get('content') or attributes.get('teaser_text') or ""
                    
                # Process attachments
                included = post_data.get('included', [])
                for item in included:
                    if item.get('type') == 'attachment':
                        att_attrs = item.get('attributes', {})
                        att_url = att_attrs.get('url', '')
                        att_name = att_attrs.get('name', '')
                        if att_url and att_name:
                            attachments.append({
                                "name": att_name,
                                "url": att_url
                            })
            else:
                print(f"  [!] Patreon API returned status {resp.status_code}")
        except Exception as e:
            print(f"  [!] Error fetching post text from API: {e}")
            
        # Step 2b: Classify post relevance
        is_valuable = False
        relevance_reason = "No technical content or attachments found"
        tech_extensions = ['.json', '.png', '.zip', '.py', '.md', '.yaml', '.yml', '.pdf', '.txt']
        downloaded_attachments = []
        
        has_tech_attachment = False
        for att in attachments:
            name_lower = att["name"].lower()
            if any(name_lower.endswith(ext) for ext in tech_extensions):
                has_tech_attachment = True
                break
                
        if has_tech_attachment:
            is_valuable = True
            relevance_reason = "Contains technical workflow/asset attachment(s)"
        else:
            title_lower = post_title.lower()
            text_lower = text_content.lower() if text_content else ""
            
            tech_keywords = [
                "comfyui", "workflow", "tutorial", "guide", "setup", "download", "json", "prompt", 
                "install", "unreal", "blender", "davinci", "resolve", "fusion", "nodes", "nuke", 
                "code", "python", "api", "suno", "kling", "midjourney", "prompting", "sdxl", 
                "flux", "stable diffusion", "controlnet", "lora", "workflow", "method", "technique"
            ]
            showcase_indicators = ["teaser", "trailer", "preview", "reel", "gallery", "render only"]
            
            has_tech = any(k in title_lower or k in text_lower for k in tech_keywords)
            has_showcase = any(k in title_lower for k in showcase_indicators)
            has_links = any(domain in text_lower for domain in ["github.com", "huggingface.co", "drive.google.com", "dropbox.com", "mega.nz"])
            has_code_block = "```" in text_lower
            
            if (has_tech or has_links or has_code_block) and not (has_showcase and not has_tech):
                is_valuable = True
                relevance_reason = "Contains technical learning keywords or external links"
                
        print(f"  [*] Classification: {'VALUABLE' if is_valuable else 'SKIPPED'} ({relevance_reason})")
        
        if not is_valuable:
            print("  [*] Showcase or low technical value. Skipping further processing.")
            continue
            
        # Step 2c: Download valuable attachments
        if attachments:
            for att in attachments:
                att_name = att["name"]
                att_url = att["url"]
                name_lower = att_name.lower()
                if any(name_lower.endswith(ext) for ext in tech_extensions):
                    print(f"  [*] Downloading attachment: {att_name}...")
                    try:
                        att_resp = requests.get(att_url, headers=headers, cookies=cookies, stream=True, timeout=30)
                        if att_resp.status_code == 200:
                            safe_att_name = re.sub(r'[^\w\-\.]', '_', att_name)
                            att_path = os.path.join(NAS_STAGING, f"patreon_{post_id}_{safe_att_name}")
                            with open(att_path, 'wb') as f:
                                for chunk in att_resp.iter_content(chunk_size=8192):
                                    f.write(chunk)
                            print(f"    [+] Saved attachment: {att_path}")
                            downloaded_attachments.append(att_path)
                        else:
                            print(f"    [!] Failed to download attachment: status {att_resp.status_code}")
                    except Exception as e:
                        print(f"    [!] Error downloading attachment {att_name}: {e}")
                        
        # Step 2d: Structurize and save text workflow
        rag_json_path = None
        if text_content:
            rag_json_path = process_text_content(text_content, post_title, post_id)
            
        # Step 2e: Download video media if present & requested
        download_success = False
        media_path = None
        if download_media:
            ydl_opts = {
                'outtmpl': os.path.join(NAS_STAGING, '%(uploader)s_%(title)s.%(ext)s'),
                'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                'cookiefile': cookies_file,
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': ['en'],
                'writedescription': True,
                'writeinfojson': True,
                'sleep_requests': 2,
                'ignoreerrors': True
            }
            
            print("  [*] Checking and downloading media...")
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    post_info = ydl.extract_info(canonical_post_url, download=True)
                    if post_info:
                        media_path = ydl.prepare_filename(post_info)
                        if os.path.exists(media_path):
                            print(f"  [+] Media downloaded successfully: {media_path}")
                            download_success = True
                        else:
                            base_no_ext = os.path.splitext(media_path)[0]
                            matching_files = glob.glob(base_no_ext + ".*")
                            video_files = [f for f in matching_files if not f.endswith(('.json', '.description', '.vtt', '.info.json'))]
                            if video_files:
                                media_path = video_files[0]
                                print(f"  [+] Media resolved to: {media_path}")
                                download_success = True
            except yt_dlp.utils.ExtractorError as e:
                if "No supported media found" in str(e):
                    print("  [*] Post has no video media (text/image post). Skipped media download.")
                else:
                    print(f"  [!] Extractor error during download: {e}")
            except Exception as e:
                print(f"  [!] Error downloading media: {e}")
        else:
            print("  [*] Skipping video media download (running in learning-only mode).")
            
        # Step 2f: Dispatch task to broker
        if download_success and media_path:
            dispatch_url = "http://127.0.0.1:5160/api/tasks"
            task_payload = {
                "project": "creative-liberation-engine",
                "workstream": "media_processing",
                "title": f"[PATREON] Ingest {post_title}",
                "description": f"Staged Patreon media for Taste Ledger analysis at {media_path}",
                "priority": "P1",
                "source": "patreon_harvester",
                "metadata": {
                    "file_path": media_path,
                    "title": post_title,
                    "source": "patreon",
                    "rag_path": rag_json_path,
                    "attachments": downloaded_attachments,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
            try:
                print(f"  [*] Dispatching media ingest task to broker: {dispatch_url}")
                resp = requests.post(dispatch_url, json=task_payload, timeout=5)
                if resp.status_code in (200, 201):
                    print(f"    [+] Task dispatched: {resp.json().get('task', {}).get('id', 'unknown')}")
                else:
                    print(f"    [!] Dispatch failed: {resp.status_code}")
            except Exception as e:
                print(f"    [!] Dispatch error: {e}")
        elif rag_json_path or downloaded_attachments:
            # Dispatch RAG only task
            dispatch_url = "http://127.0.0.1:5160/api/tasks"
            task_payload = {
                "project": "creative-liberation-engine",
                "workstream": "general",
                "title": f"[PATREON] Ingest RAG: {post_title}",
                "description": f"Ingest harvested Patreon reasoning chains/attachments for {post_title}",
                "priority": "P2",
                "source": "patreon_harvester",
                "metadata": {
                    "rag_path": rag_json_path,
                    "title": post_title,
                    "source": "patreon",
                    "attachments": downloaded_attachments,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
            try:
                print(f"  [*] Dispatching RAG ingest task to broker: {dispatch_url}")
                resp = requests.post(dispatch_url, json=task_payload, timeout=5)
                if resp.status_code in (200, 201):
                    print(f"    [+] RAG task dispatched: {resp.json().get('task', {}).get('id', 'unknown')}")
                else:
                    print(f"    [!] Dispatch failed: {resp.status_code}")
            except Exception as e:
                print(f"    [!] Dispatch error: {e}")

    print("\n[+] Patreon harvest run complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Patreon authenticated harvester.")
    parser.add_argument("--url", required=True, help="Patreon creator or post URL")
    parser.add_argument("--cookies", default="cookies.txt", help="Path to cookies.txt exported from browser")
    parser.add_argument("--limit", default=None, help="Limit to specific playlist items (e.g. '1', '1-5')")
    parser.add_argument("--download-media", action="store_true", help="Download raw video media files")
    args = parser.parse_args()

    asyncio.run(run_harvester(
        url=args.url, 
        cookies_file=args.cookies, 
        playlist_items=args.limit, 
        download_media=args.download_media
    ))
