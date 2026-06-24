import os
import glob
import json
import argparse
import subprocess
import numpy as np
import scipy.signal
import librosa
import tempfile
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

def safe_save_json(data, filepath):
    """
    Saves a dictionary as JSON atomically using os.replace to prevent corruption.
    """
    dirname = os.path.dirname(filepath)
    if dirname and not os.path.exists(dirname):
        os.makedirs(dirname, exist_ok=True)
    
    with tempfile.NamedTemporaryFile('w', dir=dirname, delete=False, suffix=".tmp", encoding="utf-8") as tf:
        json.dump(data, tf, indent=2)
        temp_name = tf.name
    
    # Atomic replace
    os.replace(temp_name, filepath)

def find_proxy_path(video_path):
    """
    Checks if a lightweight proxy file exists for the given video clip.
    Returns the proxy path if found to optimize network reads, otherwise the original.
    """
    dirname = os.path.dirname(video_path)
    basename = os.path.basename(video_path)
    
    # Check common proxy folders (relative/subdirs)
    proxy_subdirs = ["proxy", "Proxy", "PROXY", "proxies", "Proxies"]
    for p_dir in proxy_subdirs:
        # Subdirectory
        p_path = os.path.join(dirname, p_dir, basename)
        if os.path.exists(p_path):
            return p_path
        # Sibling directory (e.g. video/../../proxy/filename)
        parent_dir = os.path.dirname(dirname)
        p_path = os.path.join(parent_dir, p_dir, basename)
        if os.path.exists(p_path):
            return p_path
            
    return video_path

def compute_waveform_match(ref_y, ref_sr, vid_y, vid_sr):
    """
    Aligns video audio to reference audio using normalized waveform cross-correlation (FFT).
    Best for identical audio recordings (multi-cam alignment).
    """
    target_sr = 4000
    if ref_sr != target_sr:
        ref_y = librosa.resample(ref_y, orig_sr=ref_sr, target_sr=target_sr)
    if vid_sr != target_sr:
        vid_y = librosa.resample(vid_y, orig_sr=vid_sr, target_sr=target_sr)
        
    # Standardize signals for proper cross-correlation scale
    ref_y = (ref_y - np.mean(ref_y)) / (np.std(ref_y) + 1e-8)
    vid_y = (vid_y - np.mean(vid_y)) / (np.std(vid_y) + 1e-8)
    
    # Fast cross-correlation using FFT
    corr = scipy.signal.fftconvolve(ref_y, vid_y[::-1], mode='valid')
    best_idx = np.argmax(corr)
    best_score = float(corr[best_idx] / len(vid_y))
    match_time_sec = float(best_idx / target_sr)
    
    return best_score, match_time_sec

def compute_chroma_match(ref_chroma, vid_chroma, ref_sr, hop_length=512):
    """
    Aligns video audio to reference audio using CENS Chroma feature correlation.
    Best for different performances of the same song (cover versions, live sets).
    """
    n_ref = ref_chroma.shape[1]
    n_vid = vid_chroma.shape[1]
    
    if n_ref < n_vid:
        vid_chroma = vid_chroma[:, :n_ref]
        n_vid = n_ref
        
    best_score = -1.0
    best_idx = -1
    
    # Vectorized sliding cosine similarity
    for i in range(n_ref - n_vid + 1):
        segment = ref_chroma[:, i:i+n_vid]
        score = np.mean(np.sum(segment * vid_chroma, axis=0))
        if score > best_score:
            best_score = float(score)
            best_idx = i
            
    match_time_sec = float(best_idx * hop_length / ref_sr)
    return best_score, match_time_sec

def analyze_video_clip(video_path, ref_data, mode="chroma_cens", threshold=0.80):
    """
    Extracts audio from video (or its proxy) and computes alignment.
    """
    # Auto-resolve proxy to minimize bandwidth over the network
    source_path = find_proxy_path(video_path)
    if source_path != video_path:
        print(f" -> Found lightweight proxy: {os.path.basename(source_path)}")
        
    # Query duration using ffprobe
    cmd_dur = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", source_path
    ]
    try:
        duration = float(subprocess.run(cmd_dur, capture_output=True, text=True).stdout.strip())
    except Exception:
        duration = 0.0
        
    if duration < 3.0:
        return None
        
    # Extract audio stream at 11025 Hz mono PCM over the network (fast)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_name = tmp.name
        
    cmd_extract = [
        "ffmpeg", "-y", "-i", source_path, "-vn", "-acodec", "pcm_s16le", "-ar", "11025", "-ac", "1",
        tmp_name
    ]
    
    try:
        subprocess.run(cmd_extract, capture_output=True, check=True)
        vid_y, vid_sr = librosa.load(tmp_name, sr=11025)
    except Exception as e:
        print(f" -> Audio extraction failed: {e}")
        return None
    finally:
        if os.path.exists(tmp_name):
            try:
                os.unlink(tmp_name)
            except Exception:
                pass
                
    if len(vid_y) < 11025 * 2: # Need at least 2 seconds
        return None
        
    if mode == "waveform":
        ref_y, ref_sr = ref_data
        best_score, match_offset = compute_waveform_match(ref_y, ref_sr, vid_y, vid_sr)
    else:
        ref_chroma, ref_sr = ref_data
        try:
            vid_chroma = librosa.feature.chroma_cens(y=vid_y, sr=vid_sr, hop_length=512)
        except Exception as e:
            print(f" -> Chroma calculation failed: {e}")
            return None
        best_score, match_offset = compute_chroma_match(ref_chroma, vid_chroma, vid_sr)
        
    is_match = bool(best_score >= threshold)
    
    result = {
        "file_name": os.path.basename(video_path),
        "folder": os.path.dirname(video_path),
        "duration": duration,
        "is_match": is_match,
        "score": best_score,
        "match_offset": match_offset,
        "processed": True
    }
    
    if is_match:
        print(f" MATCH FOUND! Score: {best_score:.4f} | Offset: {match_offset:.2f}s | Folder: {os.path.basename(os.path.dirname(video_path))}")
    else:
        print(f" No match. Score: {best_score:.4f}")
        
    return result

def main():
    parser = argparse.ArgumentParser(description="Creative Liberation Engine V6: General-Purpose Media Alignment Cataloger")
    parser.add_argument("--ref", "-r", required=True, help="Path to reference master audio bed file")
    parser.add_argument("--roots", "-s", required=True, help="Comma-separated list of directories to scan for video clips")
    parser.add_argument("--mode", "-m", choices=["chroma_cens", "waveform"], default="chroma_cens", help="Alignment strategy: chroma_cens (live cover matches) or waveform (identical mic matches)")
    parser.add_argument("--output", "-o", required=True, help="Path to write the resulting catalog JSON")
    parser.add_argument("--threshold", "-t", type=float, default=None, help="Match decision similarity threshold (defaults to 0.80 for chroma, 15.0 for waveform)")
    parser.add_argument("--concurrency", "-c", type=int, default=4, help="Number of parallel execution threads (default 4 to prevent network congestion)")
    parser.add_argument("--last-n", "-n", type=int, default=None, help="If set, only scans the last N video clips chronologically from each subdirectory (ideal for late-night sets)")
    
    args = parser.parse_args()
    
    # Establish thresholds
    threshold = args.threshold
    if threshold is None:
        threshold = 0.80 if args.mode == "chroma_cens" else 15.0
        
    print("=================================================================")
    print("CLE ENGINE V6: SOVEREIGN MEDIA ALIGNMENT CATALOGER")
    print("=================================================================")
    print(f"Reference Audio : {args.ref}")
    print(f"Search Roots    : {args.roots}")
    print(f"Alignment Mode  : {args.mode}")
    print(f"Threshold       : {threshold}")
    print(f"Concurrency     : {args.concurrency} threads")
    if args.last_n:
        print(f"Subdir Strategy : Last {args.last_n} chronological files only")
    print("=================================================================")
    
    # Load Reference
    print("\nLoading master reference audio track...")
    ref_y, ref_sr = librosa.load(args.ref, sr=11025)
    print(f"Loaded: {len(ref_y)} samples at {ref_sr} Hz ({len(ref_y)/ref_sr:.2f} seconds)")
    
    if args.mode == "waveform":
        ref_data = (ref_y, ref_sr)
    else:
        print("Computing reference CENS chroma profile...")
        ref_chroma = librosa.feature.chroma_cens(y=ref_y, sr=ref_sr, hop_length=512)
        print(f"Chroma shape: {ref_chroma.shape}")
        ref_data = (ref_chroma, ref_sr)
        
    # Discover video directories
    scan_roots = [r.strip() for r in args.roots.split(",") if r.strip()]
    show_dirs = []
    
    print("\nScanning roots recursively for video folders...")
    for root in scan_roots:
        if not os.path.exists(root):
            print(f"Warning: root path {root} does not exist. Skipping.")
            continue
            
        for dirpath, dirnames, filenames in os.walk(root):
            # Focus on folder names commonly storing primary camera cards
            for d in dirnames:
                if d.lower() in ["video", "a1ii", "fx30", "meganthony", "north jersey country club", "rehobeth beach country club", "wythe hotel 2026"]:
                    show_dirs.append(os.path.join(dirpath, d))
                    
    # Deduplicate, normalize, filter out actual proxy folders as scan targets
    show_dirs = sorted(list(set([os.path.abspath(p) for p in show_dirs])))
    show_dirs = [p for p in show_dirs if "proxy" not in p.lower()]
    print(f"Found {len(show_dirs)} unique video directories.")
    
    # Collect candidate clips
    candidate_files = []
    for sd in show_dirs:
        patterns = ["*.MP4", "*.mp4", "*.MOV", "*.mov"]
        files = []
        for pat in patterns:
            files.extend(glob.glob(os.path.join(sd, pat)))
        files = sorted(list(set(files)))
        if not files:
            continue
            
        # Chronological sorting by modified time
        mtimes = [os.path.getmtime(f) for f in files]
        files_with_time = sorted(zip(files, mtimes), key=lambda x: x[1])
        sorted_files = [f for f, m in files_with_time]
        
        if args.last_n:
            sub_candidates = sorted_files[-args.last_n:]
        else:
            sub_candidates = sorted_files
            
        candidate_files.extend(sub_candidates)
        
    print(f"Collected {len(candidate_files)} candidate video files to analyze.")
    
    # Load existing catalog progress
    catalog = {}
    if os.path.exists(args.output):
        try:
            with open(args.output, 'r', encoding="utf-8") as f:
                catalog = json.load(f)
            print(f"Loaded existing catalog: {len(catalog)} clips cached.")
        except Exception:
            print("Failed to read existing catalog JSON. Starting fresh.")
            
    # Process files
    print("\n--- ANALYZING VIDEO AUDIO IN PARALLEL ---")
    catalog_lock = threading.Lock()
    match_count = 0
    
    def worker_job(vf):
        # Skip if already cached
        if vf in catalog and catalog[vf].get("processed", False):
            return catalog[vf]
            
        print(f"\nProcessing: {os.path.basename(vf)}")
        try:
            res = analyze_video_clip(vf, ref_data, args.mode, threshold)
            if res:
                with catalog_lock:
                    catalog[vf] = res
                    safe_save_json(catalog, args.output)
                return res
        except Exception as e:
            print(f"Error analyzing {os.path.basename(vf)}: {e}")
        return None
        
    try:
        with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
            futures = {executor.submit(worker_job, vf): vf for vf in candidate_files}
            for idx, future in enumerate(as_completed(futures)):
                res = future.result()
                if res and res.get("is_match", False):
                    match_count += 1
                print(f"Progress: {idx+1}/{len(candidate_files)} processed.")
    except KeyboardInterrupt:
        print("\nProcess interrupted by user. Saved active progress.")
        
    print("\n=================================================================")
    print(f"ALIGNMENT CATALOGING COMPLETED. Found {match_count} matched clips.")
    print(f"Result catalog saved: {args.output}")
    print("=================================================================")

if __name__ == "__main__":
    main()
