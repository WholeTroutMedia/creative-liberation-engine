#!/usr/bin/env python3
import os
import sys
import argparse
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

    # Connect to running DaVinci Resolve instance
    print("Connecting to DaVinci Resolve...")
    resolve = dvr_script.scriptapp("Resolve")
    if not resolve:
        print("Error: Could not connect to DaVinci Resolve.")
        print("Please ensure:")
        print("  1. DaVinci Resolve Studio is running.")
        print("  2. Preferences > System > Control Panels > External Scripting is set to 'Local' or 'Network'.")
        sys.exit(1)

    project_manager = resolve.GetProjectManager()
    if not project_manager:
        print("Error: Could not get Project Manager from Resolve.")
        sys.exit(1)

    # Check active database connection
    current_db = project_manager.GetCurrentDatabase()
    print(f"Connected to Active Database: {current_db.get('DbName', 'Default')} ({current_db.get('DbType', 'Disk')})")

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
        print("Error: Failed to import media clips.")
        sys.exit(1)

    print(f"Successfully imported {len(imported_clips)} clips.")

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

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a DaVinci Resolve project, import proxies, and build a timeline.")
    parser.add_argument("ingest_path", help="Path to the ingested media directory containing Proxies subfolder")
    parser.add_argument("project_name", help="Name of the Resolve project to create")
    
    args = parser.parse_args()
    build_resolve_project(args.ingest_path, args.project_name)
