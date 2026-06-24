import os
import json
import random
import argparse
import subprocess
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
    parser.add_argument("--database", "-d", default="Barnstorm", help="Target Resolve database/Project Library")
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
    print(f"Target Database : {args.database}")
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
    
    # 2. Divide song into slots and construct the EDL sequence
    selected_sequence = []
    
    for k in range(total_slots):
        start_time = k * args.slice
        end_time = (k + 1) * args.slice
        
        candidates = []
        for path, clip in matches.items():
            offset = clip["match_offset"]
            duration = clip["duration"]
            if offset <= start_time and (offset + duration) >= end_time:
                target_path = find_proxy_path(path) if args.use_proxies else path
                candidates.append((target_path, clip))
                
        if candidates:
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
            
    unique_paths = list(set([item["path"] for item in selected_sequence]))
    print(f"Generated timeline sequence: {len(selected_sequence)} slices from {len(unique_paths)} unique videos.")
    
    def execute_resolve_code(code, action_desc):
        payload = {"code": code, "projectName": args.project}
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

    # Step 3.1: Initialize Project safely inside the target database & folder
    print(f"Step 1: Safely connecting to database '{args.database}', creating/loading project '{args.project}'...")
    init_code = f"""
resolve = dvr_script.scriptapp("Resolve")
pm = resolve.GetProjectManager()

current_db = pm.GetCurrentDatabase()
current_db_name = current_db.get("DbName", "")

# 1. Database switching safety check
if current_db_name != "{args.database}":
    db_list = pm.GetDatabaseList()
    target_db_info = None
    for db in db_list:
        if db.get("DbName") == "{args.database}":
            target_db_info = db
            break
    if target_db_info:
        active_proj = pm.GetCurrentProject()
        if active_proj and active_proj.GetName() != "Untitled Project":
            active_name = active_proj.GetName()
            is_production_db = current_db_name in ["Barnstorm", "Jaymee", "Levi"]
            is_test_proj = any(kw in active_name.lower() for kw in ["test", "autogen", "temp", "splat", "conform", "demo", "scratch"])
            if is_production_db and not is_test_proj:
                result = {{"success": False, "error": f"Resolve Safety Gate: Active GUI project '{{active_name}}' is open in library '{{current_db_name}}'. Switch to '{args.database}' rejected."}}
                raise RuntimeError("Database switch safety block")
        print("Switching database to: {args.database}")
        pm.SetCurrentDatabase(target_db_info)

# 2. Active project protection safety check
active_proj = pm.GetCurrentProject()
if active_proj and active_proj.GetName() != "Untitled Project" and active_proj.GetName() != "{args.project}":
    active_name = active_proj.GetName()
    current_db = pm.GetCurrentDatabase()
    current_db_name = current_db.get("DbName", "")
    is_production_db = current_db_name in ["Barnstorm", "Jaymee", "Levi"]
    is_test_proj = any(kw in active_name.lower() for kw in ["test", "autogen", "temp", "splat", "conform", "demo", "scratch"])
    if is_production_db and not is_test_proj:
        result = {{"success": False, "error": f"Resolve Safety Gate: Active GUI project '{{active_name}}' is open. Project change to '{args.project}' rejected."}}
        raise RuntimeError("Active project safety block")

# 3. Dynamic project folder organization inside the database
lower_path = "{args.project}".lower()
if "patreon" in lower_path:
    folder_path = "Patreon"
elif "podcast" in lower_path:
    folder_path = "Podcast"
elif "splat" in lower_path or "3dgs" in lower_path:
    folder_path = "3DGS_Splat"
else:
    folder_path = "Automation"

pm.GotoRootFolder()
existing_folders = pm.GetFolderListInCurrentFolder() or []
if folder_path not in existing_folders:
    pm.CreateFolder(folder_path)
pm.OpenFolder(folder_path)

# 4. Load or create project
project_list = pm.GetProjectListInCurrentFolder() or []
proj = None
if "{args.project}" in project_list:
    proj = pm.LoadProject("{args.project}")
else:
    proj = pm.CreateProject("{args.project}")

if proj:
    proj.SetSetting("timelineFrameRate", "{args.fps}")
    mp = proj.GetMediaPool()
    root_folder = mp.GetRootFolder()
    
    audio_folder = None
    video_folder = None
    for f in root_folder.GetSubFolderList():
        if f.GetName() in ["Master Audio", "Audio"]:
            audio_folder = f
        elif f.GetName() in ["Raw Video Clips", "Proxies"]:
            video_folder = f
            
    if not audio_folder:
        audio_folder = mp.AddSubFolder(root_folder, "Master Audio")
    if not video_folder:
        video_folder = mp.AddSubFolder(root_folder, "Raw Video Clips")
        
    mp.SetCurrentFolder(audio_folder)
    
    # Avoid duplicate audio import
    audio_exists = False
    for clip in audio_folder.GetClipList() or []:
        if clip.GetClipProperty("File Path") == r"{args.audio}":
            audio_exists = True
            break
    if not audio_exists:
        mp.ImportMedia([r"{args.audio}"])
        
    pm.SaveProject()
    result = {{"success": True}}
else:
    result = {{"success": False, "error": "Failed to create or load project"}}
"""
    res = execute_resolve_code(init_code, "Project Initialization")
    if not res or not res.get("success", False):
        error_msg = res.get("error", "Unknown error during project initialization.") if res else "Connection failed."
        print(f"\n[ERROR] Initialization failed: {error_msg}")
        return

    # Step 3.2: Batch Import Video Clips
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
    if f.GetName() in ["Raw Video Clips", "Proxies"]:
        video_folder = f
        break

if video_folder:
    mp.SetCurrentFolder(video_folder)
    imported_clips = mp.ImportMedia({repr(chunk)})
    if not imported_clips:
        all_clips = video_folder.GetClipList() or []
        imported_clips = []
        chunk_basenames = [os.path.basename(p) for p in {repr(chunk)}]
        for c in all_clips:
            file_path = c.GetClipProperty("File Path")
            if file_path and os.path.basename(file_path) in chunk_basenames:
                imported_clips.append(c)
    
    # Metadata Injection logic
    import os
    import json
    for mv in imported_clips or []:
        file_path = mv.GetClipProperty("File Path")
        if not file_path:
            continue
        sidecar_path = file_path + ".json"
        if not os.path.exists(sidecar_path):
            base, ext = os.path.splitext(file_path)
            sidecar_path = base + ".json"
            
        if os.path.exists(sidecar_path):
            try:
                with open(sidecar_path, "r", encoding="utf-8") as sf:
                    meta = json.load(sf)
                tags = meta.get("tags", [])
                env = meta.get("environmental", dict())
                sync = meta.get("sync", dict())
                
                # Set description and keywords
                description = ", ".join(tags)
                mv.SetMetadata("Description", description)
                mv.SetMetadata("Keywords", description)
                
                # Set comments
                comments = f"Ingested by camera-ingest. Checksum: {{meta.get('checksum_sha256', '')}}"
                mv.SetMetadata("Comments", comments)
                
                # Set Camera
                camera_id = env.get("camera_id") or meta.get("source_device")
                if camera_id:
                    mv.SetMetadata("Camera", str(camera_id))
                
                # Set start timecode
                tc = sync.get("timecode")
                if tc:
                    mv.SetMetadata("Start TC", str(tc))
                    
                # Set clip color based on sharpness
                sharpness = env.get("sharpness", 120.0)
                if sharpness > 150.0:
                    mv.SetClipColor("Green")
                    mv.AddFlag("Green")
                elif sharpness < 90.0:
                    mv.SetClipColor("Red")
                    mv.AddFlag("Red")
                else:
                    mv.SetClipColor("Yellow")
                    
                if "selected" in [t.lower() for t in tags]:
                    mv.AddFlag("Blue")
            except Exception as me:
                print(f"Error applying metadata inside bridge: {{me}}")
                
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
    if f.GetName() in ["Master Audio", "Audio"]:
        audio_folder = f
    elif f.GetName() in ["Raw Video Clips", "Proxies"]:
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

# Append video slices sequentially
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
