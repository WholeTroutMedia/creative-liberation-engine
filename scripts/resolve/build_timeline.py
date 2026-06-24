import os
import json
import random
import argparse
import urllib.request
import urllib.error

def find_proxy_path(video_path):
    """
    Checks if a lightweight proxy file exists for the given video clip.
    """
    dirname = os.path.dirname(video_path)
    basename = os.path.basename(video_path)
    
    proxy_subdirs = ["proxy", "Proxy", "PROXY", "proxies", "Proxies"]
    for p_dir in proxy_subdirs:
        # Subdirectory
        p_path = os.path.join(dirname, p_dir, basename)
        if os.path.exists(p_path):
            return p_path
        # Sibling directory
        parent_dir = os.path.dirname(dirname)
        p_path = os.path.join(parent_dir, p_dir, basename)
        if os.path.exists(p_path):
            return p_path
            
    return video_path

def main():
    parser = argparse.ArgumentParser(description="Creative Liberation Engine V6: Parameterized Resolve Timeline Assembler")
    parser.add_argument("--catalog", "-c", required=True, help="Path to the catalog JSON file containing matched clips")
    parser.add_argument("--audio", "-a", required=True, help="Path to the master audio bed track on the NAS/network")
    parser.add_argument("--project", "-p", default="Sovereign Supercut", help="Name of the Resolve project to create")
    parser.add_argument("--timeline", "-t", default="Supercut Timeline", help="Name of the timeline within the project")
    parser.add_argument("--fps", type=float, default=23.976, help="Timeline frame rate (default 23.976)")
    parser.add_argument("--slice", "-s", type=float, default=3.0, help="Cut slice duration in seconds (default 3.0)")
    parser.add_argument("--use-proxies", action="store_true", help="If set, imports proxy clips in Resolve instead of high-res source files")
    parser.add_argument("--bridge-url", default="http://127.0.0.1:5105/execute", help="DaVinci Resolve scripting bridge execution URL")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.catalog):
        print(f"Error: Catalog file not found at '{args.catalog}'")
        return
        
    print("=================================================================")
    print("CLE ENGINE V6: PARAMETERIZED TIMELINE ASSEMBLER")
    print("=================================================================")
    print(f"Catalog JSON    : {args.catalog}")
    print(f"Master Audio    : {args.audio}")
    print(f"Resolve Project : {args.project}")
    print(f"Timeline Name   : {args.timeline}")
    print(f"Frame Rate (FPS): {args.fps}")
    print(f"Slice Duration  : {args.slice}s")
    print(f"Import Proxies  : {args.use_proxies}")
    print("=================================================================")
    
    # 1. Load Catalog
    with open(args.catalog, 'r', encoding="utf-8") as f:
        catalog = json.load(f)
        
    matches = {k: v for k, v in catalog.items() if v.get("is_match", False)}
    print(f"Loaded {len(matches)} matched clips from catalog.")
    
    if not matches:
        print("No matching clips found in the catalog. Timeline assembly aborted.")
        return
        
    # Get master audio duration using ffprobe
    cmd_dur = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", args.audio
    ]
    try:
        song_duration = float(subprocess.run(cmd_dur, capture_output=True, text=True, shell=True).stdout.strip())
    except Exception:
        # Fallback to standard song duration
        song_duration = 255.0
        print(f"Warning: Could not read audio file duration via ffprobe. Defaulting to {song_duration}s")
        
    slice_frames = int(args.slice * args.fps)
    total_slots = int(song_duration / args.slice)
    
    print(f"Master Audio Duration: {song_duration:.2f} seconds | Slots: {total_slots}")
    
    # 2. Divide song into slots and construct the EDL (Edit Decision List) sequence
    selected_sequence = []
    
    for k in range(total_slots):
        start_time = k * args.slice
        end_time = (k + 1) * args.slice
        
        # Find matched clips covering this temporal range
        candidates = []
        for path, clip in matches.items():
            offset = clip["match_offset"]
            duration = clip["duration"]
            if offset <= start_time and (offset + duration) >= end_time:
                # Resolve target clip path (source vs proxy)
                target_path = find_proxy_path(path) if args.use_proxies else path
                candidates.append((target_path, clip))
                
        if candidates:
            # Pick a random candidate clip for high visual energy
            target_path, clip = random.choice(candidates)
            source_in = int((start_time - clip["match_offset"]) * args.fps)
            source_out = source_in + slice_frames
            selected_sequence.append({
                "path": target_path,
                "name": clip["file_name"],
                "source_in": source_in,
                "source_out": source_out,
                "is_fallback": False
            })
        else:
            # Fallback: select a random clip and cut a random 3-second segment (creates continuous pacing)
            path, clip = random.choice(list(matches.items()))
            target_path = find_proxy_path(path) if args.use_proxies else path
            duration_frames = int(clip["duration"] * args.fps)
            if duration_frames > slice_frames + 48:
                source_in = random.randint(24, duration_frames - slice_frames - 24)
            else:
                source_in = 0
            source_out = source_in + slice_frames
            selected_sequence.append({
                "path": target_path,
                "name": clip["file_name"],
                "source_in": source_in,
                "source_out": source_out,
                "is_fallback": True
            })
            
    # Deduplicate video import list
    unique_paths = list(set([item["path"] for item in selected_sequence]))
    print(f"Generated timeline sequence: {len(selected_sequence)} slices from {len(unique_paths)} unique videos.")
    
    # 3. Helper to send code to Resolve bridge
    def execute_resolve_code(code, action_desc):
        payload = {"code": code}
        req = urllib.request.Request(args.bridge_url, data=json.dumps(payload).encode("utf-8"), method="POST")
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                return res
        except Exception as e:
            print(f"Error during '{action_desc}': {e}")
            return None

    print("\n--- INITIATING DYNAMIC TIMELINE ASSEMBLY ---")

    # Step 3.1: Initialize Project, FPS settings and Import Master Audio
    print("Step 1: Initializing Resolve project & importing master audio track...")
    init_code = f"""
resolve = dvr_script.scriptapp("Resolve")
pm = resolve.GetProjectManager()
current_project = pm.GetCurrentProject()
if current_project:
    pm.CloseProject(current_project)

pm.DeleteProject("{args.project}")
proj = pm.CreateProject("{args.project}")
if proj:
    proj.SetSetting("timelineFrameRate", "{args.fps}")
    mp = proj.GetMediaPool()
    root_folder = mp.GetRootFolder()
    
    # Create or retrieve bins
    audio_folder = mp.AddSubFolder(root_folder, "Master Audio")
    video_folder = mp.AddSubFolder(root_folder, "Raw Video Clips")
    
    mp.SetCurrentFolder(audio_folder)
    mp.ImportMedia([r"{args.audio}"])
    pm.SaveProject()
    result = {{"success": True}}
else:
    result = {{"success": False, "error": "Failed to create project"}}
"""
    res = execute_resolve_code(init_code, "Project Initialization")
    if not res or not res.get("success", False):
        print("Initialization failed. Aborting assembly.")
        return

    # Step 3.2: Batch Import Video Clips (chunked to avoid socket resets)
    chunk_size = 5
    total_chunks = (len(unique_paths) - 1) // chunk_size + 1
    print(f"Step 2: Batch importing {len(unique_paths)} video assets into media pool in {total_chunks} chunk(s) (chunk size: {chunk_size})...")
    
    for i in range(0, len(unique_paths), chunk_size):
        chunk = unique_paths[i:i+chunk_size]
        print(f" -> Importing batch {i//chunk_size + 1}/{total_chunks} ({len(chunk)} files)...")
        batch_code = f"""
resolve = dvr_script.scriptapp("Resolve")
pm = resolve.GetProjectManager()
proj = pm.GetCurrentProject()
mp = proj.GetMediaPool()
root_folder = mp.GetRootFolder()

video_folder = None
for f in root_folder.GetSubFolderList():
    if f.GetName() == "Raw Video Clips":
        video_folder = f
        break

if video_folder:
    mp.SetCurrentFolder(video_folder)
    mp.ImportMedia({repr(chunk)})
    pm.SaveProject()
    result = {{"success": True}}
else:
    result = {{"success": False, "error": "Raw Video Clips folder not found"}}
"""
        execute_resolve_code(batch_code, f"Batch Video Import {i//chunk_size + 1}")

    # Step 3.3: Construct and Compile Timeline
    print("Step 3: Compiling synchronized timeline and building cuts sequence...")
    timeline_code = f"""
resolve = dvr_script.scriptapp("Resolve")
pm = resolve.GetProjectManager()
proj = pm.GetCurrentProject()
mp = proj.GetMediaPool()
root_folder = mp.GetRootFolder()

# Find audio and video bins
audio_folder = None
video_folder = None
for f in root_folder.GetSubFolderList():
    if f.GetName() == "Master Audio":
        audio_folder = f
    elif f.GetName() == "Raw Video Clips":
        video_folder = f

# Get all imported video items
imported_videos = []
if video_folder:
    imported_videos = video_folder.GetClipList()

# Get audio item
audio_clip = None
if audio_folder:
    audio_clips = audio_folder.GetClipList()
    if audio_clips:
        audio_clip = audio_clips[0]

# Map File Path and Name properties
media_item_map = {{}}
for mv in imported_videos:
    media_item_map[mv.GetClipProperty("File Path")] = mv
    media_item_map[mv.GetName()] = mv

# Create Timeline
mp.SetCurrentFolder(root_folder)
timeline = mp.CreateEmptyTimeline("{args.timeline}")

# Place master audio (Audio Track 1)
if audio_clip:
    mp.AppendToTimeline([audio_clip])

# Append video slices sequentially (Audio automatically routes to Track 2)
sequence = {repr(selected_sequence)}
appended_count = 0

for idx, item in enumerate(sequence):
    path = item["path"]
    name = item["name"]
    sin = item["source_in"]
    sout = item["source_out"]
    
    clip_obj = media_item_map.get(path) or media_item_map.get(name)
    if clip_obj:
        clip_obj.ClearMarkInOut()
        clip_obj.SetMarkInOut(sin, sout)
        appended = mp.AppendToTimeline([clip_obj])
        clip_obj.ClearMarkInOut()
        if appended:
            appended_count += 1
        else:
            print(f"Failed to append slot {{idx}}: {{name}}")
    else:
        print(f"Clip not found in media pool: {{name}}")
        
pm.SaveProject()
result = {{
    "success": True,
    "project_name": proj.GetName(),
    "timeline_name": timeline.GetName() if timeline else "None",
    "imported_videos_count": len(imported_videos),
    "slots_appended": appended_count,
    "total_slots": len(sequence)
}}
"""
    res = execute_resolve_code(timeline_code, "Timeline Assembly")
    if res:
        print("\n--- RESOLVE ASSEMBLY METRICS ---")
        print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main()
