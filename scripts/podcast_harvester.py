import os
import sys
import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import subprocess
from datetime import datetime

# ── Paths & Config ───────────────────────────────────────────────────────────
RSS_FEED_URL = "https://feeds.acast.com/public/shows/food-network-obsessed"
APPLE_PODCAST_ID = "1548679153"

# Base paths inside workspace
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(WORKSPACE_ROOT, "data")
REPORTS_DIR = os.path.join(WORKSPACE_ROOT, "reports")

# Ensure workspace directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

BACKLOG_JSON_PATH = os.path.join(DATA_DIR, "podcast_backlog.json")
ANALYTICS_JSON_PATH = os.path.join(REPORTS_DIR, "podcast_analytics_summary.json")

# Determine NAS paths based on OS
if os.name == 'nt':
    MEDIA_DOWNLOAD_DIR = r"\\127.0.0.1\The Vault\RAW Backups\2026\Barnstorm\live-ingest\podcast"
else:
    MEDIA_DOWNLOAD_DIR = "/app/vault/RAW Backups/2026/Barnstorm/live-ingest/podcast"

# ── RSS Harvesting ───────────────────────────────────────────────────────────
def fetch_rss_feed():
    print(f"[RSS] Fetching feed from {RSS_FEED_URL}...")
    req = urllib.request.Request(
        RSS_FEED_URL, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CLEEngineV6/1.0'}
    )
    with urllib.request.urlopen(req) as response:
        return response.read()

def parse_rss_feed(xml_data):
    print("[RSS] Parsing XML feed...")
    root = ET.fromstring(xml_data)
    channel = root.find("channel")
    if channel is None:
        raise ValueError("Invalid RSS feed format: <channel> not found.")

    episodes = []
    # Namespaces
    namespaces = {
        'itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
        'acast': 'https://schema.acast.com/1.0/'
    }

    for item in channel.findall("item"):
        title = item.find("title")
        description = item.find("description")
        pub_date = item.find("pubDate")
        link = item.find("link")
        enclosure = item.find("enclosure")
        guid = item.find("guid")

        # Optional iTunes elements
        itunes_duration = item.find("itunes:duration", namespaces)
        itunes_episode = item.find("itunes:episode", namespaces)
        itunes_season = item.find("itunes:season", namespaces)

        audio_url = enclosure.attrib.get("url") if enclosure is not None else None
        audio_size = int(enclosure.attrib.get("length", 0)) if enclosure is not None else 0
        audio_type = enclosure.attrib.get("type") if enclosure is not None else None

        # Clean title (sometimes contains season/episode markers)
        title_str = title.text.strip() if title is not None else "Untitled Episode"
        desc_str = description.text.strip() if description is not None else ""
        pub_date_str = pub_date.text.strip() if pub_date is not None else ""
        
        # Parse pubDate into standard format
        pub_date_iso = ""
        if pub_date_str:
            try:
                # e.g., "Thu, 04 Jun 2026 10:00:00 GMT"
                dt = datetime.strptime(pub_date_str.replace("GMT", "+0000"), "%a, %d %b %Y %H:%M:%S %z")
                pub_date_iso = dt.isoformat()
            except Exception:
                pub_date_iso = pub_date_str

        episodes.append({
            "guid": guid.text.strip() if guid is not None else audio_url,
            "title": title_str,
            "description": desc_str,
            "pub_date_raw": pub_date_str,
            "pub_date": pub_date_iso,
            "audio_url": audio_url,
            "audio_size_bytes": audio_size,
            "audio_type": audio_type,
            "duration": itunes_duration.text.strip() if itunes_duration is not None else "",
            "episode": itunes_episode.text.strip() if itunes_episode is not None else "",
            "season": itunes_season.text.strip() if itunes_season is not None else "",
            "link": link.text.strip() if link is not None else ""
        })

    return episodes

def save_backlog(episodes):
    existing = []
    if os.path.exists(BACKLOG_JSON_PATH):
        try:
            with open(BACKLOG_JSON_PATH, 'r', encoding='utf-8') as f:
                existing = json.load(f)
        except Exception as e:
            print(f"[Warn] Failed to load existing backlog: {e}")

    # Merge by GUID
    existing_guids = {ep.get("guid") for ep in existing if ep.get("guid")}
    new_count = 0
    for ep in episodes:
        if ep.get("guid") not in existing_guids:
            existing.append(ep)
            new_count += 1

    # Sort by pub_date descending
    existing.sort(key=lambda x: x.get("pub_date", ""), reverse=True)

    with open(BACKLOG_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)

    print(f"[RSS] Backlog updated. Total episodes: {len(existing)} (Added {new_count} new episodes).")
    return existing

def download_episodes(episodes, limit=None, force=False):
    os.makedirs(MEDIA_DOWNLOAD_DIR, exist_ok=True)
    print(f"[Download] Targeting NAS directory: {MEDIA_DOWNLOAD_DIR}")
    
    downloaded_count = 0
    errors = 0

    for ep in episodes:
        if limit is not None and downloaded_count >= limit:
            break

        audio_url = ep.get("audio_url")
        if not audio_url:
            continue

        # Sanitize filename
        safe_title = "".join(c for c in ep["title"] if c.isalnum() or c in (" ", "-", "_")).strip()
        safe_title = safe_title.replace(" ", "_")[:60]
        pub_date_short = ep.get("pub_date", "")[:10].replace("-", "")
        filename = f"{pub_date_short}_{safe_title}.mp3"
        dest_path = os.path.join(MEDIA_DOWNLOAD_DIR, filename)

        if os.path.exists(dest_path) and not force:
            continue

        print(f"[Download] Downloading: {ep['title']}...")
        try:
            req = urllib.request.Request(
                audio_url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CLEEngineV6/1.0'}
            )
            with urllib.request.urlopen(req) as response:
                with open(dest_path, 'wb') as out_file:
                    out_file.write(response.read())
            print(f"[Download] Successfully saved to {dest_path}")
            downloaded_count += 1
        except Exception as e:
            print(f"[Error] Failed to download {ep['title']}: {e}")
            errors += 1

    print(f"[Download] Download cycle finished. Downloaded: {downloaded_count}, Errors: {errors}")

# ── Apple Podcasts Analytics & Reviews ───────────────────────────────────────
def get_apple_podcast_metadata():
    url = f"https://itunes.apple.com/lookup?id={APPLE_PODCAST_ID}"
    print(f"[Apple] Fetching Apple metadata from {url}...")
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            results = data.get("results", [])
            if results:
                return results[0]
    except Exception as e:
        print(f"[Error] Failed to fetch Apple podcast metadata: {e}")
    return {}

def get_apple_reviews():
    url = f"https://itunes.apple.com/rss/customerreviews/id={APPLE_PODCAST_ID}/json"
    print(f"[Apple] Fetching customer reviews from {url}...")
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            feed = data.get("feed", {})
            entry = feed.get("entry", [])
            
            reviews = []
            # Note: The first entry is often the podcast metadata itself
            for item in entry[1:]:
                try:
                    reviews.append({
                        "author": item.get("author", {}).get("name", {}).get("label"),
                        "title": item.get("title", {}).get("label"),
                        "rating": int(item.get("im:rating", {}).get("label", 0)),
                        "content": item.get("content", {}).get("label"),
                        "id": item.get("id", {}).get("label")
                    })
                except Exception as ex:
                    print(f"[Warn] Skipping individual review parse error: {ex}")
            return reviews
    except Exception as e:
        print(f"[Error] Failed to fetch Apple reviews: {e}")
    return []

# ── YouTube Video Harvest ────────────────────────────────────────────────────
def harvest_youtube_podcast_episodes():
    print("[YouTube] Scanning for Food Network Obsessed video podcast episodes using yt-dlp...")
    # Target search query on Food Network's channel to extract metrics
    # yt-dlp is expected to be installed on NAS or host.
    cmd = [
        "yt-dlp",
        "--dump-json",
        "ytsearch50:Food Network Obsessed",
        "--skip-download"
    ]
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
        stdout, stderr = process.communicate()
        
        if process.returncode != 0:
            print(f"[Error] yt-dlp returned non-zero code {process.returncode}. Error: {stderr}")
            return []
            
        videos = []
        for line in stdout.splitlines():
            if not line:
                continue
            try:
                vid_data = json.loads(line)
                title = vid_data.get("title", "")
                # Clean and filter to ensure it's the Food Network Obsessed podcast
                if "obsessed" in title.lower() and "food network" in title.lower():
                    videos.append({
                        "video_id": vid_data.get("id"),
                        "title": title,
                        "view_count": vid_data.get("view_count", 0),
                        "like_count": vid_data.get("like_count", 0),
                        "comment_count": vid_data.get("comment_count", 0),
                        "upload_date": vid_data.get("upload_date"),
                        "url": vid_data.get("webpage_url"),
                        "duration_seconds": vid_data.get("duration", 0),
                        "channel": vid_data.get("channel")
                    })
            except Exception as ex:
                print(f"[Warn] Failed to parse YouTube item: {ex}")
                
        print(f"[YouTube] Found {len(videos)} matching video episodes on YouTube.")
        return videos
    except FileNotFoundError:
        print("[Error] yt-dlp was not found on PATH. Make sure it is installed and available.")
        return []
    except Exception as e:
        print(f"[Error] Failed to run yt-dlp search: {e}")
        return []

# ── Aggregator & Summary ─────────────────────────────────────────────────────
def run_aggregation(download_limit=None, download_audio_files=False):
    # 1. RSS Harvester
    try:
        xml_data = fetch_rss_feed()
        rss_episodes = parse_rss_feed(xml_data)
        all_episodes = save_backlog(rss_episodes)
    except Exception as e:
        print(f"[Fatal] RSS harvesting failed: {e}")
        if os.path.exists(BACKLOG_JSON_PATH):
            with open(BACKLOG_JSON_PATH, 'r', encoding='utf-8') as f:
                all_episodes = json.load(f)
        else:
            all_episodes = []

    # 2. Selective Audio Download
    if download_audio_files and all_episodes:
        download_episodes(all_episodes, limit=download_limit)

    # 3. Apple Podcast Metadata & Reviews
    apple_meta = get_apple_podcast_metadata()
    reviews = get_apple_reviews()

    # Calculate review metrics
    avg_rating = 0.0
    ratings_dist = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    if reviews:
        total = 0
        for r in reviews:
            rate = r.get("rating", 0)
            if rate in ratings_dist:
                ratings_dist[rate] += 1
                total += rate
        avg_rating = round(total / len(reviews), 2)

    # 4. YouTube Metrics
    yt_videos = harvest_youtube_podcast_episodes()

    # Calculate aggregate YouTube metrics
    total_yt_views = sum(v["view_count"] for v in yt_videos)
    total_yt_likes = sum(v["like_count"] for v in yt_videos)
    total_yt_comments = sum(v["comment_count"] for v in yt_videos)
    
    # 5. Estimated Downloads & Listenership (Rephonic/Industry Formula)
    # Average podcast reviews-to-downloads ratio ranges from 1:75 to 1:150.
    # Total ratings/reviews acts as a footprint.
    estimated_listenership_per_episode = 0
    estimated_total_downloads = 0
    
    # If we have ratings metadata from Apple
    track_count = int(apple_meta.get("trackCount", len(all_episodes))) or 1
    
    # Simplecast/Industry estimates based on Apple Review count
    review_count = len(reviews)
    if review_count > 0:
        # standard estimation model (public footprint review count * standard multiplier)
        estimated_listenership_per_episode = int((review_count * 150) / 10) # rough estimate of core listeners
        estimated_total_downloads = estimated_listenership_per_episode * track_count
        
    # Overwrite with YouTube views if available as video podcasts represent visual engagement
    if yt_videos:
        avg_yt_views = total_yt_views / len(yt_videos)
        # Hybrid estimated audience
        if avg_yt_views > estimated_listenership_per_episode:
            estimated_listenership_per_episode = int(avg_yt_views)
            estimated_total_downloads = int(total_yt_views + (estimated_listenership_per_episode * (track_count - len(yt_videos))))

    # Compile the Consolidated Report
    report = {
        "show_title": apple_meta.get("collectionName", "Food Network Obsessed"),
        "host": "Jaymee Sire",
        "publisher": apple_meta.get("artistName", "Food Network"),
        "apple_podcast_id": APPLE_PODCAST_ID,
        "rss_feed": RSS_FEED_URL,
        "total_rss_episodes": len(all_episodes),
        "last_updated": datetime.utcnow().isoformat() + "Z",
        "apple_metrics": {
            "genre": apple_meta.get("primaryGenreName"),
            "track_count": track_count,
            "average_user_rating": avg_rating,
            "reviews_analyzed_count": len(reviews),
            "ratings_distribution": ratings_dist,
            "recent_reviews": reviews[:10]  # Store latest 10 reviews
        },
        "youtube_metrics": {
            "videos_scanned_count": len(yt_videos),
            "total_views": total_yt_views,
            "total_likes": total_yt_likes,
            "total_comments": total_yt_comments,
            "average_views_per_episode": int(total_yt_views / len(yt_videos)) if yt_videos else 0,
            "episodes": yt_videos
        },
        "audience_estimates": {
            "estimated_listeners_per_episode": estimated_listenership_per_episode,
            "estimated_total_downloads_historic": estimated_total_downloads,
            "notes": "Audience size estimated using a hybrid Apple reviews multiplier model combined with actual YouTube podcast view analytics."
        }
    }

    # Write unified report
    with open(ANALYTICS_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n[Summary] Consolidated report written to {ANALYTICS_JSON_PATH}")
    print("="*60)
    print(f"Podcast: {report['show_title']}")
    print(f"Host: {report['host']} // Publisher: {report['publisher']}")
    print(f"Total Audio Episodes: {report['total_rss_episodes']}")
    print(f"Apple Rating (Recent Reviews): {report['apple_metrics']['average_user_rating']} / 5.0")
    print(f"YouTube Podcast Video Episodes Scanned: {report['youtube_metrics']['videos_scanned_count']}")
    print(f"YouTube Total Views: {report['youtube_metrics']['total_views']:,}")
    print(f"Estimated Core Listeners Per Episode: {report['audience_estimates']['estimated_listeners_per_episode']:,}")
    print(f"Estimated Total Downloads (All Time): {report['audience_estimates']['estimated_total_downloads_historic']:,}")
    print("="*60)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Food Network Obsessed Podcast Harvester")
    parser.add_argument("action", choices=["rss", "youtube", "apple", "all"], help="Action to execute")
    parser.add_argument("--download", action="store_true", help="Download MP3 audio files during RSS run")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of audio files to download")
    parser.add_argument("--force", action="store_true", help="Force redownload of existing audio files")

    args = parser.parse_args()

    if args.action == "rss":
        xml_data = fetch_rss_feed()
        eps = parse_rss_feed(xml_data)
        all_eps = save_backlog(eps)
        if args.download:
            download_episodes(all_eps, limit=args.limit, force=args.force)
    elif args.action == "youtube":
        yt_vids = harvest_youtube_podcast_episodes()
        print(json.dumps(yt_vids, indent=2))
    elif args.action == "apple":
        meta = get_apple_podcast_metadata()
        revs = get_apple_reviews()
        print(f"Metadata: {json.dumps(meta, indent=2)}")
        print(f"Reviews Count: {len(revs)}")
        print(f"Sample Reviews: {json.dumps(revs[:3], indent=2)}")
    elif args.action == "all":
        run_aggregation(download_limit=args.limit, download_audio_files=args.download)
