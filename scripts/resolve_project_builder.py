#!/usr/bin/env python3
import os
import sys
import argparse
import subprocess
import time
from pathlib import Path

# Auto-detect DaVinci Resolve Python scripting API path on Windows
resolve_api_path = os.path.expandvars(r"%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting\Modules")
if os.path.exists(resolve_api_path):
    sys.path.append(resolve_api_path)
else:
    print(f"Warning: Resolve API path not found at standard location: {resolve_api_path}")

try:
    import DaVinciResolveScript as dvr_script
except ImportError:
    print("Error: Could not import DaVinciResolveScript. Please ensure DaVinci Resolve is installed.")
    sys.exit(1)

def get_resolve_processes():
    processes = []
    try:
        cmd = 'wmic process where "name=\'Resolve.exe\'" get ProcessId,CommandLine /format:list'
        output = subprocess.check_output(cmd, shell=True).decode("utf-8", errors="ignore")
        current_proc = {}
        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue
            if line.startswith("CommandLine="):
                current_proc["commandline"] = line[12:]
            elif line.startswith("ProcessId="):
                current_proc["pid"] = line[10:]
                processes.append(current_proc)
                current_proc = {}
    except Exception as e:
        print(f"Error checking processes: {e}")
    return processes

def is_gui_resolve_running():
    procs = get_resolve_processes()
    for p in procs:
        cmdline = p.get("commandline", "")
        if cmdline and "-nogui" not in cmdline.lower():
            return True
    return False

def safe_connect_resolve(target_db="Barnstorm", target_project=None, folder_path=None):
    gui_active = is_gui_resolve_running()
    launched_headless = False
    resolve_process = None

    if not gui_active:
        print("DaVinci Resolve GUI is not running. Launching Resolve in headless mode (-nogui)...")
        resolve_path = r"C:\Program Files\Blackmagic Design\DaVinci Resolve\Resolve.exe"
        if not os.path.exists(resolve_path):
            raise RuntimeError(f"Resolve executable not found at: {resolve_path}")
        resolve_process = subprocess.Popen([resolve_path, "-nogui"])
        launched_headless = True
        print("Spawned headless Resolve. Waiting 15 seconds for startup...")
        time.sleep(15)
    else:
        print("DaVinci Resolve GUI is active. Connecting to running session...")

    resolve = dvr_script.scriptapp("Resolve")
    if not resolve:
        if launched_headless and resolve_process:
            resolve_process.terminate()
        raise RuntimeError("Could not connect to DaVinci Resolve scripting API.")

    pm = resolve.GetProjectManager()
    if not pm:
        if launched_headless and resolve_process:
            resolve_process.terminate()
        raise RuntimeError("Could not get Project Manager from Resolve.")

    # Ensure we are in the correct database/Project Library
    current_db = pm.GetCurrentDatabase()
    current_db_name = current_db.get("DbName", "")
    if current_db_name != target_db:
        if gui_active:
            raise RuntimeError(
                f"Resolve Safety Gate: GUI is active in database '{current_db_name}', "
                f"but automation requested database '{target_db}'. Switching databases in the GUI "
                f"is blocked to prevent interrupting your work."
            )
        db_list = pm.GetDatabaseList()
        target_db_info = None
        for db in db_list:
            if db.get("DbName") == target_db:
                target_db_info = db
                break
        if target_db_info:
            print(f"Switching database from '{current_db_name}' to '{target_db}'...")
            success = pm.SetCurrentDatabase(target_db_info)
            if not success:
                if launched_headless and resolve_process:
                    resolve_process.terminate()
                raise RuntimeError(f"Failed to switch to database '{target_db}'.")
        else:
            print(f"Warning: Target database '{target_db}' not found. Remaining in '{current_db_name}'.")

    # Protect active project in GUI if different
    active_project = pm.GetCurrentProject()
    if active_project and active_project.GetName() != "Untitled Project":
        active_name = active_project.GetName()
        if target_project and active_name != target_project:
            if gui_active:
                raise RuntimeError(
                    f"Resolve Safety Gate: Active GUI project '{active_name}' is open. "
                    f"Automation cannot close your active project to open '{target_project}'. "
                    f"Please close the project or finish your work in Resolve."
                )

    # Organize project folder structure if folder_path is specified
    if folder_path:
        pm.GotoRootFolder()
        folders = [f.strip() for f in folder_path.split("/") if f.strip()]
        for folder_name in folders:
            existing_folders = pm.GetFolderListInCurrentFolder() or []
            if folder_name not in existing_folders:
                print(f"Creating project folder: {folder_name}")
                pm.CreateFolder(folder_name)
            pm.OpenFolder(folder_name)

    return resolve, pm, launched_headless, resolve_process

def apply_clip_metadata(clip, resolve):
    import json
    file_path = clip.GetClipProperty("File Path")
    if not file_path:
        return
    
    # Check for companion JSON sidecar file
    sidecar_path = file_path + ".json"
    if not os.path.exists(sidecar_path):
        base, ext = os.path.splitext(file_path)
        sidecar_path = base + ".json"
        
    if os.path.exists(sidecar_path):
        try:
            with open(sidecar_path, "r", encoding="utf-8") as sf:
                meta = json.load(sf)
            
            tags = meta.get("tags", [])
            env = meta.get("environmental", {})
            sync = meta.get("sync", {})
            
            # Set description and keywords
            description = ", ".join(tags)
            clip.SetMetadata("Description", description)
            clip.SetMetadata("Keywords", description)
            
            # Set comments
            comments = f"Ingested by camera-ingest. Checksum: {meta.get('checksum_sha256', '')}"
            clip.SetMetadata("Comments", comments)
            
            # Set Camera
            camera_id = env.get("camera_id") or meta.get("source_device")
            if camera_id:
                clip.SetMetadata("Camera", str(camera_id))
            
            # Set start timecode if present
            tc = sync.get("timecode")
            if tc:
                clip.SetMetadata("Start TC", str(tc))
                
            # Set Clip Color based on sharpness metric
            sharpness = env.get("sharpness", 120.0)
            if sharpness > 150.0:
                clip.SetClipColor("Green")
                clip.AddFlag("Green")
            elif sharpness < 90.0:
                clip.SetClipColor("Red")
                clip.AddFlag("Red")
            else:
                clip.SetClipColor("Yellow")
                
            # If manually/AI selected, add a Blue flag
            if "selected" in [t.lower() for t in tags]:
                clip.AddFlag("Blue")
                
            print(f"Applied AI metadata to {os.path.basename(file_path)}")
        except Exception as e:
            print(f"Error applying metadata to {os.path.basename(file_path)}: {e}")

def build_resolve_project(ingest_path, project_name):
    ingest_dir = Path(ingest_path)
    if not ingest_dir.exists():
        print(f"Error: Ingest directory does not exist: {ingest_dir}")
        sys.exit(1)

    proxies_dir = ingest_dir / "Proxies"
    if not proxies_dir.exists():
        print(f"Warning: Proxies directory not found at: {proxies_dir}. Scanning root ingest folder instead.")
        proxies_dir = ingest_dir

    # Find video files
    video_extensions = {".mp4", ".mov", ".mxf", ".mkv"}
    video_files = [
        str(p.resolve()) for p in proxies_dir.glob("*")
        if p.suffix.lower() in video_extensions and not p.name.startswith(".")
    ]

    if not video_files:
        print(f"No video files found in {proxies_dir} to import.")
        sys.exit(0)

    print(f"Found {len(video_files)} video clips to import.")

    # Find external audio files (Audio/ or root)
    audio_dir = ingest_dir / "Audio"
    if not audio_dir.exists():
        audio_dir = ingest_dir
    audio_extensions = {".wav", ".mp3", ".m4a", ".aif", ".aiff"}
    audio_files = [
        str(p.resolve()) for p in audio_dir.glob("*")
        if p.suffix.lower() in audio_extensions and not p.name.startswith(".")
    ]
    if audio_files:
        print(f"Found {len(audio_files)} audio clips to import.")

    # Determine project folder based on ingest path context
    lower_path = str(ingest_dir).lower()
    if "patreon" in lower_path:
        folder_path = "Patreon"
    elif "podcast" in lower_path:
        folder_path = "Podcast"
    elif "splat" in lower_path or "3dgs" in lower_path:
        folder_path = "3DGS_Splat"
    else:
        folder_path = "Automation"

    print(f"Inferred target folder path: '{folder_path}'")

    # Connect to DaVinci Resolve safely
    try:
        resolve, project_manager, launched_headless, resolve_process = safe_connect_resolve(
            target_db="Barnstorm",
            target_project=project_name,
            folder_path=folder_path
        )
    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(1)

    try:
        # Create or load project
        print(f"Creating project: {project_name}")
        project = project_manager.CreateProject(project_name)
        if not project:
            print(f"Project '{project_name}' already exists. Loading existing project.")
            project = project_manager.LoadProject(project_name)
            if not project:
                print(f"Error: Failed to load project '{project_name}'.")
                sys.exit(1)

        media_pool = project.GetMediaPool()
        if not media_pool:
            print("Error: Could not get Media Pool.")
            sys.exit(1)

        # Set up folder structure in Media Pool
        root_folder = media_pool.GetRootFolder()
        
        # Create / check if 'Proxies' folder exists
        proxies_folder = None
        for subfolder in root_folder.GetSubFolderList():
            if subfolder.GetName() == "Proxies":
                proxies_folder = subfolder
                break
                
        if not proxies_folder:
            proxies_folder = media_pool.AddSubFolder(root_folder, "Proxies")
            
        media_pool.SetCurrentFolder(proxies_folder)

        # Import media files into the proxies bin
        print(f"Importing {len(video_files)} clips into 'Proxies' bin...")
        imported_clips = media_pool.ImportMedia(video_files)
        if not imported_clips:
            print("Clips might already be imported. Retrieving existing clips in 'Proxies' bin...")
            imported_clips = proxies_folder.GetClipList() or []
            
        if not imported_clips:
            print("Error: Failed to import or find existing media clips.")
            sys.exit(1)

        print(f"Successfully imported or loaded {len(imported_clips)} clips.")

        # Apply AI metadata and color code videos
        for clip in imported_clips:
            apply_clip_metadata(clip, resolve)

        imported_audio = []
        if audio_files:
            # Create / check if 'Audio' folder exists
            audio_folder = None
            for subfolder in root_folder.GetSubFolderList():
                if subfolder.GetName() == "Audio":
                    audio_folder = subfolder
                    break
            if not audio_folder:
                audio_folder = media_pool.AddSubFolder(root_folder, "Audio")
            
            media_pool.SetCurrentFolder(audio_folder)
            print(f"Importing {len(audio_files)} audio clips into 'Audio' bin...")
            imported_audio = media_pool.ImportMedia(audio_files)
            if not imported_audio:
                print("Audio clips might already be imported. Retrieving existing audio clips...")
                imported_audio = audio_folder.GetClipList() or []
                
            if imported_audio:
                print(f"Successfully imported or loaded {len(imported_audio)} audio clips.")
                # Apply AI metadata to audio if sidecars exist
                for clip in imported_audio:
                    apply_clip_metadata(clip, resolve)

        # Auto-sync audio and video via waveforms if both exist
        if imported_clips and imported_audio:
            print("Auto-syncing video clips with external audio via waveforms...")
            clips_to_sync = imported_clips + imported_audio
            sync_success = media_pool.AutoSyncAudio(clips_to_sync, {
                resolve.AUDIO_SYNC_MODE: resolve.AUDIO_SYNC_WAVEFORM,
                resolve.AUDIO_SYNC_CHANNEL_NUMBER: resolve.AUDIO_SYNC_CHANNEL_AUTOMATIC,
                resolve.AUDIO_SYNC_RETAIN_EMBEDDED_AUDIO: False,
                resolve.AUDIO_SYNC_RETAIN_VIDEO_METADATA: True
            })
            if sync_success:
                print("Waveform sync successfully executed.")
            else:
                print("Warning: Waveform auto-sync failed to match clips.")

        # Create assembly timeline
        timeline_name = f"{project_name} Assembly"
        print(f"Creating timeline: {timeline_name}")
        
        # Check if timeline already exists
        timeline_exists = False
        for i in range(1, project.GetTimelineCount() + 1):
            if project.GetTimelineByIndex(i).GetName() == timeline_name:
                timeline_exists = True
                print(f"Timeline '{timeline_name}' already exists.")
                break
                
        # Force UTF-8 encoding for stdout/stderr to prevent Windows console encoding issues
        try:
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        except AttributeError:
            pass # Fallback for older python environments where reconfigure doesn't exist

        if not timeline_exists:
            # Create timeline from clips
            media_pool.SetCurrentFolder(proxies_folder)
            timeline = media_pool.CreateTimelineFromClips(timeline_name, imported_clips)
            if timeline:
                print(f"[OK] Created timeline '{timeline_name}' with {len(imported_clips)} clips.")
            else:
                print("Warning: Failed to automatically create timeline from clips.")

        # Save the project
        success = project_manager.SaveProject()
        if success:
            print(f"[OK] Project '{project_name}' saved successfully.")
        else:
            print("Warning: Failed to save project.")

    finally:
        # Clean up headless Resolve process if we spawned it
        if launched_headless and resolve_process:
            print("Terminating headless DaVinci Resolve background process...")
            resolve_process.terminate()
            try:
                resolve_process.wait(timeout=5)
                print("Headless DaVinci Resolve closed successfully.")
            except subprocess.TimeoutExpired:
                print("Headless Resolve did not terminate. Killing...")
                resolve_process.kill()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a DaVinci Resolve project, import proxies, and build a timeline.")
    parser.add_argument("ingest_path", help="Path to the ingested media directory containing Proxies subfolder")
    parser.add_argument("project_name", help="Name of the Resolve project to create")
    
    args = parser.parse_args()
    build_resolve_project(args.ingest_path, args.project_name)
