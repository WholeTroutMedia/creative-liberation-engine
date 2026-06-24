#!/usr/bin/env python3
"""
Creative Liberation Engine V6: YouTube Media Harvester

This script utilizes yt-dlp to autonomously fetch high-quality media and 
subtitles from expert YouTube channels. The videos are staged for transient/optical 
flow analysis (Taste Ledger) and the subtitles are parsed into reasoning chains 
for the RAG database.

By using yt-dlp, we avoid browser overhead and can easily scrape entire playlists.
"""

import os
import argparse
import asyncio
import json
import re
import requests
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

# Route heavy media straight to the NAS over the 10GbE mesh
NAS_STAGING = get_nas_path(r"\\127.0.0.1\docker\creative-liberation-engine\media_intake\staging")
NAS_RAG_DATA = get_nas_path(r"\\127.0.0.1\docker\creative-liberation-engine\media_intake\Resolve_RAG_Data\YouTube")

def ensure_directories():
    print(f"[*] Verifying NAS target directories...")
    os.makedirs(NAS_STAGING, exist_ok=True)
    os.makedirs(NAS_RAG_DATA, exist_ok=True)
    print(f"  [+] Staging: {NAS_STAGING}")
    print(f"  [+] RAG Data: {NAS_RAG_DATA}")


def clean_vtt_text(vtt_content):
    """Simple parser to remove timestamps and VTT metadata from subtitles."""
    lines = vtt_content.split('\n')
    text_lines = []
    for line in lines:
        if '-->' in line or line.startswith('WEBVTT') or line.startswith('Kind:') or line.startswith('Language:') or not line.strip():
            continue
        # Remove any HTML-like tags (e.g. <c> )
        clean_line = re.sub(r'<[^>]+>', '', line).strip()
        if clean_line and clean_line not in text_lines:
            text_lines.append(clean_line)
    return " ".join(text_lines)

def process_subtitles(subtitle_file, video_title, video_id):
    """Reads the downloaded subtitle file, cleans it, and structures it via the local LLM."""
    print(f"[*] Processing downloaded subtitles: {subtitle_file}")
    try:
        with open(subtitle_file, 'r', encoding='utf-8') as f:
            raw_subs = f.read()
        
        cleaned_text = clean_vtt_text(raw_subs)
        print(f"[*] Extracted {len(cleaned_text)} characters of dialogue/reasoning.")
        
        print("[*] Structurizing narrative into expert reasoning chains...")
        import reasoning_structurizer
        
        structured_data = reasoning_structurizer.structurize_text_to_reasoning_chains(cleaned_text)
        
        safe_title = re.sub(r'[^\w\-]', '_', video_title.lower())
        target_filename = f"youtube_{video_id}_{safe_title}_chains.json"
        target_json_path = os.path.join(NAS_RAG_DATA, target_filename)
        
        reasoning_structurizer.save_structured_data(structured_data, target_json_path)
        print(f"[+] Knowledge extraction complete. JSON saved to {target_json_path}")
        return target_json_path
    except Exception as e:
        print(f"[!] Error processing subtitles: {e}")
        return None

async def run_harvester(url, discipline='ATHENA', download_media=False):
    print("=====================================================")
    print(" V6 SOVEREIGN MEDIA MESH - YOUTUBE HARVESTER SWARM   ")
    print("=====================================================")
    ensure_directories()
    
    print(f"[*] Target URL: {url}")
    print(f"[*] Discipline: {discipline}")
    print(f"[*] Download Media setting: {download_media}")
    
    # Step 1: Extract playlist/video metadata first (download=False)
    meta_opts = {
        'cookiefile': 'cookies.txt' if os.path.exists('cookies.txt') else None,
        'extract_flat': False, # Get full video info but don't download
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitleslangs': ['en'],
        'ignoreerrors': True,
    }
    
    print("[*] Retrieving metadata from YouTube...")
    try:
        with yt_dlp.YoutubeDL(meta_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            entries = info.get('entries', [info]) if 'entries' in info else [info]
            print(f"[+] Found {len(entries)} video entries.")
    except Exception as e:
        print(f"[!] Error extracting YouTube metadata: {e}")
        return
        
    # Step 2: Iterate over entries, filter and download
    for index, entry in enumerate(entries):
        if not entry:
            continue
        video_title = entry.get('title', 'Unknown_Video')
        video_id = entry.get('id', 'unknown')
        duration = entry.get('duration')
        description = entry.get('description') or ""
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        
        # Classification criteria
        is_teaser = False
        if duration and duration < 90:
            is_teaser = True
            
        title_lower = video_title.lower()
        desc_lower = description.lower()
        
        showcase_indicators = ["teaser", "trailer", "preview", "reel", "showcase", "short", "promo"]
        is_showcase = any(k in title_lower for k in showcase_indicators)
        
        tech_keywords = [
            "comfyui", "workflow", "tutorial", "guide", "setup", "download", "json", "prompt", 
            "install", "unreal", "blender", "davinci", "resolve", "fusion", "nodes", "nuke", 
            "code", "python", "api", "suno", "kling", "midjourney", "prompting", "sdxl", 
            "flux", "stable diffusion", "controlnet", "lora", "workflow", "method", "technique"
        ]
        has_tech = any(k in title_lower or k in desc_lower for k in tech_keywords)
        
        is_valuable = (has_tech or not is_showcase) and not (is_teaser and not has_tech)
        
        print(f"\n[*] Processing video {index+1}/{len(entries)}: {video_title} (ID: {video_id}, {duration or '?'}s)")
        print(f"  [*] Classification: {'VALUABLE' if is_valuable else 'SKIPPED'} (teaser={is_teaser}, showcase={is_showcase}, tech={has_tech})")
        
        if not is_valuable:
            print("  [*] Video classified as showcase or teaser with low technical value. Skipping.")
            continue
            
        # Download options based on media download preference
        dl_opts = {
            'outtmpl': os.path.join(NAS_STAGING, '%(title)s.%(ext)s'),
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['en'],
            'writedescription': True,
            'writeinfojson': True,
            'ignoreerrors': True,
        }
        
        if download_media:
            dl_opts['format'] = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
            dl_opts['skip_download'] = False
            print("  [*] Downloading video media and subtitles...")
        else:
            dl_opts['skip_download'] = True
            print("  [*] Downloading subtitles/description only (running in learning-only mode)...")
            
        download_success = False
        media_path = None
        
        try:
            with yt_dlp.YoutubeDL(dl_opts) as ydl:
                # We extract info with download=True (this executes download based on skip_download setting)
                post_info = ydl.extract_info(video_url, download=True)
                if post_info:
                    media_path = ydl.prepare_filename(post_info)
                    download_success = not dl_opts['skip_download']
                    
                    # Process subtitles
                    requested_subs = post_info.get('requested_subtitles')
                    rag_json_path = None
                    if requested_subs and 'en' in requested_subs:
                        sub_ext = requested_subs['en']['ext']
                        # Construct subtitle path
                        base_no_ext = os.path.splitext(media_path)[0]
                        actual_sub_path = f"{base_no_ext}.en.{sub_ext}"
                        
                        if os.path.exists(actual_sub_path):
                            rag_json_path = process_subtitles(actual_sub_path, video_title, video_id)
                        else:
                            # Try replacing standard formats
                            actual_sub_path = media_path.replace('.mp4', f'.en.{sub_ext}')
                            if os.path.exists(actual_sub_path):
                                rag_json_path = process_subtitles(actual_sub_path, video_title, video_id)
                            else:
                                print(f"  [!] Subtitle file not found at expected path: {actual_sub_path}")
                    else:
                        print(f"  [*] No English subtitles found/requested for: {video_title}")
                        
                    if download_success:
                        print(f"  [+] Media successfully staged at: {media_path}")
                    else:
                        print(f"  [+] Subtitles and description successfully harvested.")
                        
                    # Dispatch Webhook
                    dispatch_url = "http://127.0.0.1:5160/api/tasks"
                    if download_success:
                        task_payload = {
                            "project": "creative-liberation-engine",
                            "workstream": "media_processing",
                            "title": f"[YOUTUBE] Ingest {video_title}",
                            "description": f"Staged YouTube media for Taste Ledger analysis at {media_path}",
                            "priority": "P1",
                            "source": "youtube_harvester",
                            "metadata": {
                                "file_path": media_path,
                                "title": video_title,
                                "video_id": video_id,
                                "source": "youtube",
                                "discipline": discipline,
                                "rag_path": rag_json_path,
                                "timestamp": datetime.now(timezone.utc).isoformat()
                            }
                        }
                    else:
                        task_payload = {
                            "project": "creative-liberation-engine",
                            "workstream": "general",
                            "title": f"[YOUTUBE] Ingest RAG: {video_title}",
                            "description": f"Ingest harvested YouTube subtitles/reasoning chains for {video_title}",
                            "priority": "P2",
                            "source": "youtube_harvester",
                            "metadata": {
                                "title": video_title,
                                "video_id": video_id,
                                "source": "youtube",
                                "discipline": discipline,
                                "rag_path": rag_json_path,
                                "timestamp": datetime.now(timezone.utc).isoformat()
                            }
                        }
                        
                    try:
                        print(f"  [*] Pushing task to V6 Dispatch: {dispatch_url}")
                        resp = requests.post(dispatch_url, json=task_payload, timeout=5)
                        if resp.status_code in (200, 201):
                            print(f"    [+] Task dispatched successfully: {resp.json().get('task', {}).get('id', 'unknown')}")
                        else:
                            print(f"    [!] Dispatch failed: {resp.status_code} - {resp.text}")
                    except Exception as e:
                        print(f"    [!] Failed to reach Dispatch API: {e}")
                        
        except Exception as e:
            print(f"  [!] Error processing video {video_title}: {e}")

    print("\n[+] YouTube harvest run complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run YouTube yt-dlp harvester.")
    parser.add_argument("--url", required=True, help="YouTube video or playlist URL")
    parser.add_argument("--discipline", default="ATHENA", help="Ingest discipline (e.g. CODEX, PRISM)")
    parser.add_argument("--download-media", action="store_true", help="Download raw video media files")
    args = parser.parse_args()

    asyncio.run(run_harvester(
        url=args.url, 
        discipline=args.discipline, 
        download_media=args.download_media
    ))

