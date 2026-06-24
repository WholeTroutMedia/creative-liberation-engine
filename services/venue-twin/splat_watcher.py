import time
import subprocess
import os
import glob
import json
from pathlib import Path
from datetime import datetime

# Paths
WATCH_DIR = r"W:\Creative Liberation Engine\Venues"
CONDA_ENV = "nerfstudio"
SPLAT_TRAINER = r"D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine\services\venue-twin\splat_trainer.py"
CONDA_ACTIVATE = r"C:\Users\jahar\miniconda3\Scripts\activate.bat"
STATUS_FILE = r"\\127.0.0.1\docker\creative-liberation-engine\surfaces\spatial-os\public\splat_status.json"

def write_status(state, venue_id=None, details=""):
    status = {
        "state": state,
        "venue_id": venue_id,
        "details": details,
        "last_updated": datetime.now().isoformat()
    }
    try:
        os.makedirs(os.path.dirname(STATUS_FILE), exist_ok=True)
        with open(STATUS_FILE, 'w') as f:
            json.dump(status, f)
    except Exception as e:
        print(f"Failed to write status file: {e}")

def is_gpu_idle(threshold_utilization=90, threshold_memory=8000):
    try:
        # Get GPU utilization and memory usage using nvidia-smi
        output = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used", "--format=csv,noheader,nounits"],
            encoding='utf-8'
        )
        for line in output.strip().split('\n'):
            util, mem = map(int, line.split(', '))
            if util < threshold_utilization and mem < threshold_memory:
                return True
    except Exception as e:
        print(f"Failed to query GPU status: {e}")
    return False

def find_unprocessed_videos():
    # Find all MP4 files in the Venues directory
    videos = glob.glob(os.path.join(WATCH_DIR, "**", "*.MP4"), recursive=True)
    unprocessed = []
    
    for video in videos:
        venue_dir = os.path.dirname(video)
        # Check if the splat output directory already exists
        splat_dir = os.path.join(venue_dir, "_splat_workspace")
        if not os.path.exists(splat_dir):
            unprocessed.append(video)
            
    return unprocessed

def process_video(video_path):
    venue_dir = os.path.dirname(video_path)
    venue_id = os.path.basename(venue_dir)
    print(f"[WATCHER] Starting pipeline for {venue_id} with video: {os.path.basename(video_path)}")
    write_status("processing", venue_id, "Running 3DGS pipeline (Frame Extraction & Splatfacto)")
    
    python_exe = r"C:\Users\jahar\miniconda3\envs\nerfstudio\python.exe"
    cmd = [
        python_exe, SPLAT_TRAINER,
        "--input", venue_dir,
        "--method", "nerfstudio",
        "--venue-id", venue_id,
        "--room-id", "Main"
    ]
    
    try:
        process = subprocess.Popen(cmd)
        process.wait()
        print(f"[WATCHER] Finished processing {venue_id}.")
        write_status("idle", venue_id, "Processing complete")
    except Exception as e:
        print(f"[WATCHER] Error processing {venue_id}: {e}")
        write_status("error", venue_id, f"Pipeline error: {str(e)}")

def main():
    print("[WATCHER] 3DGS Auto-Processor started. Monitoring directory:", WATCH_DIR)
    write_status("idle", None, "Monitoring for new videos...")
    while True:
        unprocessed = find_unprocessed_videos()
        
        if unprocessed:
            print(f"[WATCHER] Found {len(unprocessed)} unprocessed video(s). Checking GPU...")
            write_status("idle", None, f"Found {len(unprocessed)} video(s). Waiting for GPU...")
            if is_gpu_idle():
                print("[WATCHER] GPU is idle. Initiating processing...")
                # Process the first one found
                process_video(unprocessed[0])
            else:
                print("[WATCHER] GPU is currently busy. Will retry later.")
        else:
            write_status("idle", None, "Monitoring for new videos...")
        
        # Sleep for a minute before checking again
        time.sleep(60)

if __name__ == "__main__":
    main()
