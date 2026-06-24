#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Creative Liberation Engine V6 — DaVinci Resolve 21.0 Beta Scripting Bridge Server
Exposes DaVinci Resolve Studio scripting APIs over HTTP to the NAS/Docker mesh.
Running locally on the Windows workstation.
"""

import sys
import os

# Prevent importing local inspect.py from workspace root if it exists
try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
except NameError:
    script_dir = os.path.dirname(os.path.abspath(sys.argv[0])) if sys.argv else os.getcwd()
sys.path = [p for p in sys.path if p not in ("", ".", os.getcwd(), script_dir)]


from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import traceback

# Setup DaVinci Resolve Scripting API environment
os.environ["RESOLVE_SCRIPT_API"] = r"C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting"
os.environ["RESOLVE_SCRIPT_LIB"] = r"C:\Program Files\Blackmagic Design\DaVinci Resolve\fusionscript.dll"
sys.path.append(r"C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting\Modules")

try:
    import DaVinciResolveScript as dvr_script
    print("[bridge] DaVinciResolveScript module successfully imported.")
except ImportError:
    dvr_script = None
    print("[bridge] Warning: DaVinciResolveScript module could not be imported.")

def get_resolve():
    if dvr_script is None:
        return None
    return dvr_script.scriptapp("Resolve")

def get_current_project():
    resolve = get_resolve()
    if not resolve:
        return None
    pm = resolve.GetProjectManager()
    if not pm:
        return None
    return pm.GetCurrentProject()

def get_current_folder():
    proj = get_current_project()
    if not proj:
        return None
    mp = proj.GetMediaPool()
    if not mp:
        return None
    return mp.GetCurrentFolder()

def get_marker_color_constant(resolve, color_name):
    if not color_name:
        return getattr(resolve, "MARKER_BLUE", "Blue")
    attr_name = f"MARKER_{color_name.strip().upper()}"
    if hasattr(resolve, attr_name):
        return getattr(resolve, attr_name)
    return color_name

class ResolveBridgeRequestHandler(BaseHTTPRequestHandler):
    def _send_response(self, status_code, data):
        try:
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode("utf-8"))
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            # Client disconnected before we could send the response — non-fatal
            pass

    def log_message(self, format, *args):
        """Override to suppress noisy tracebacks for disconnected clients."""
        print(f"[bridge] {self.client_address[0]} - {format % args}")

    def is_safe_to_modify(self, target_project=None):
        resolve = get_resolve()
        if not resolve:
            return True, None
            
        pm = resolve.GetProjectManager()
        if not pm:
            return True, None
            
        # Check if GUI is running
        try:
            import subprocess
            cmd = 'wmic process where "name=\'Resolve.exe\'" get ProcessId,CommandLine /format:list'
            output = subprocess.check_output(cmd, shell=True).decode("utf-8", errors="ignore")
            procs = []
            current_proc = {}
            for line in output.splitlines():
                line = line.strip()
                if not line:
                    continue
                if line.startswith("CommandLine="):
                    current_proc["commandline"] = line[12:]
                elif line.startswith("ProcessId="):
                    current_proc["pid"] = line[10:]
                    procs.append(current_proc)
                    current_proc = {}
                    
            gui_running = False
            for p in procs:
                cmdline = p.get("commandline", "")
                if cmdline and "-nogui" not in cmdline.lower():
                    gui_running = True
                    break
            
            # If no GUI is active, it is always safe to run background automation
            if not gui_running:
                return True, None
        except Exception:
            pass # Fallback to standard check if process check fails
            
        active_project = pm.GetCurrentProject()
        current_db = pm.GetCurrentDatabase()
        current_db_name = current_db.get("DbName", "")
        
        # Working production databases that must be protected
        production_dbs = {"Barnstorm", "Jaymee", "Levi"}
        
        if active_project and active_project.GetName() != "Untitled Project":
            active_name = active_project.GetName()
            
            # If target project matches active project, it is safe (media conforming in active project)
            if target_project and active_name == target_project:
                return True, None
                
            is_production_db = current_db_name in production_dbs
            is_test_project = any(kw in active_name.lower() for kw in ["test", "autogen", "temp", "splat", "conform", "demo", "scratch"])
            
            if is_production_db and not is_test_project:
                return False, f"Resolve Safety Gate: Active GUI project '{active_name}' is open in database '{current_db_name}'. Modified operation rejected to prevent interrupting your work."
                
        return True, None

    def do_OPTIONS(self):
        self._send_response(200, {"status": "ok"})

    def do_GET(self):
        if self.path == "/health":
            self.handle_health()
        else:
            self._send_response(404, {"error": "Not Found"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"
        
        try:
            params = json.loads(post_data.decode("utf-8")) if post_data else {}
        except Exception:
            self._send_response(400, {"error": "Invalid JSON"})
            return

        # safety gate on modifying operations
        modifying_paths = {
            "/transcribe", "/classify-audio", "/deblur", "/intellisearch",
            "/slate-sync", "/generate-speech", "/assemble-timeline", "/execute"
        }
        if self.path in modifying_paths:
            target_project = params.get("projectName", None)
            is_safe, error_msg = self.is_safe_to_modify(target_project)
            if not is_safe:
                self._send_response(403, {"error": error_msg})
                return

        if self.path == "/transcribe":
            self.handle_transcribe(params)
        elif self.path == "/classify-audio":
            self.handle_classify_audio(params)
        elif self.path == "/deblur":
            self.handle_deblur(params)
        elif self.path == "/intellisearch":
            self.handle_intellisearch(params)
        elif self.path == "/slate-sync":
            self.handle_slate_sync(params)
        elif self.path == "/generate-speech":
            self.handle_generate_speech(params)
        elif self.path == "/assemble-timeline":
            self.handle_assemble_timeline(params)
        elif self.path == "/execute":
            self.handle_execute(params)
        else:
            self._send_response(404, {"error": "Not Found"})


    def handle_health(self):
        resolve = get_resolve()
        resolve_running = resolve is not None
        
        data = {
            "status": "healthy" if resolve_running else "degraded",
            "service": "davinci-resolve-bridge",
            "resolve_running": resolve_running,
            "scripting_enabled": dvr_script is not None
        }
        
        if resolve_running:
            try:
                data["product"] = resolve.GetProductName()
                data["version"] = resolve.GetVersionString()
                proj = get_current_project()
                if proj:
                    data["current_project"] = proj.GetName()
                else:
                    data["current_project"] = None
            except Exception as e:
                data["error"] = str(e)
                
        self._send_response(200, data)

    def handle_transcribe(self, params):
        resolve = get_resolve()
        if not resolve:
            self._send_response(503, {"error": "DaVinci Resolve is not running or scripting is disabled"})
            return
            
        use_speaker_detection = params.get("useSpeakerDetection", None)
        folder = get_current_folder()
        if not folder:
            self._send_response(400, {"error": "No project or active media pool folder loaded"})
            return
            
        try:
            print(f"[bridge] Executing TranscribeAudio with useSpeakerDetection={use_speaker_detection}")
            # TranscribeAudio returns bool
            if use_speaker_detection is not None:
                success = folder.TranscribeAudio(useSpeakerDetection=bool(use_speaker_detection))
            else:
                success = folder.TranscribeAudio()
                
            self._send_response(200, {"success": success})
        except Exception as e:
            self._send_response(500, {"error": str(e), "traceback": traceback.format_exc()})

    def handle_classify_audio(self, params):
        resolve = get_resolve()
        if not resolve:
            self._send_response(503, {"error": "DaVinci Resolve is not running"})
            return
            
        folder = get_current_folder()
        if not folder:
            self._send_response(400, {"error": "No project or active media pool folder loaded"})
            return
            
        try:
            print("[bridge] Executing PerformAudioClassification")
            success = folder.PerformAudioClassification()
            self._send_response(200, {"success": success})
        except Exception as e:
            self._send_response(500, {"error": str(e), "traceback": traceback.format_exc()})

    def handle_deblur(self, params):
        resolve = get_resolve()
        if not resolve:
            self._send_response(503, {"error": "DaVinci Resolve is not running"})
            return
            
        clip_name = params.get("clipName", None)
        deblur_option = params.get("deblurOption", {})
        
        folder = get_current_folder()
        if not folder:
            self._send_response(400, {"error": "No project or active media pool folder loaded"})
            return
            
        try:
            # Debblur can be applied to individual MediaPoolItems
            clips = folder.GetClipList()
            if not clips:
                self._send_response(404, {"error": "No clips found in current folder"})
                return
                
            targeted_clips = []
            if clip_name:
                for c in clips:
                    if c.GetName() == clip_name:
                        targeted_clips.append(c)
                if not targeted_clips:
                    self._send_response(404, {"error": f"Clip '{clip_name}' not found"})
                    return
            else:
                # If no clip name specified, apply to the first clip or return error
                targeted_clips = [clips[0]]
                print(f"[bridge] No clipName specified. Defaulting to first clip: {clips[0].GetName()}")
                
            results = []
            for clip in targeted_clips:
                print(f"[bridge] Applying RemoveMotionBlur on clip: {clip.GetName()}")
                new_clip = clip.RemoveMotionBlur(deblur_option)
                if new_clip:
                    results.append({
                        "original": clip.GetName(),
                        "new_clip": new_clip.GetName(),
                        "success": True
                    })
                else:
                    results.append({
                        "original": clip.GetName(),
                        "success": False
                    })
                    
            self._send_response(200, {"results": results})
        except Exception as e:
            self._send_response(500, {"error": str(e), "traceback": traceback.format_exc()})

    def handle_intellisearch(self, params):
        resolve = get_resolve()
        if not resolve:
            self._send_response(503, {"error": "DaVinci Resolve is not running"})
            return
            
        clip_name = params.get("clipName", None)
        identify_faces = params.get("identifyFaces", True)
        is_better_mode = params.get("isBetterMode", False)
        
        folder = get_current_folder()
        if not folder:
            self._send_response(400, {"error": "No project or active folder loaded"})
            return
            
        try:
            clips = folder.GetClipList()
            if not clips:
                self._send_response(404, {"error": "No clips found in current folder"})
                return
                
            targeted_clips = []
            if clip_name:
                for c in clips:
                    if c.GetName() == clip_name:
                        targeted_clips.append(c)
                if not targeted_clips:
                    self._send_response(404, {"error": f"Clip '{clip_name}' not found"})
                    return
            else:
                # Apply to first clip
                targeted_clips = [clips[0]]
                print(f"[bridge] No clipName specified. Defaulting to first clip: {clips[0].GetName()}")
                
            results = []
            for clip in targeted_clips:
                print(f"[bridge] Executing AnalyzeForIntellisearch on {clip.GetName()} (faces={identify_faces}, better={is_better_mode})")
                success = clip.AnalyzeForIntellisearch(identify_faces, is_better_mode)
                results.append({
                    "clip": clip.GetName(),
                    "success": success
                })
                
            self._send_response(200, {"results": results})
        except Exception as e:
            self._send_response(500, {"error": str(e), "traceback": traceback.format_exc()})

    def handle_slate_sync(self, params):
        resolve = get_resolve()
        if not resolve:
            self._send_response(503, {"error": "DaVinci Resolve is not running"})
            return
            
        marker_color_name = params.get("markerColor", "Green")
        clip_name = params.get("clipName", None)
        
        folder = get_current_folder()
        if not folder:
            self._send_response(400, {"error": "No project or active folder loaded"})
            return
            
        try:
            color_const = get_marker_color_constant(resolve, marker_color_name)
            
            if clip_name:
                clips = folder.GetClipList()
                target = None
                for c in clips:
                    if c.GetName() == clip_name:
                        target = c
                        break
                if not target:
                    self._send_response(404, {"error": f"Clip '{clip_name}' not found"})
                    return
                print(f"[bridge] Executing AnalyzeForSlate on clip '{clip_name}' with color '{marker_color_name}'")
                success = target.AnalyzeForSlate(color_const)
            else:
                print(f"[bridge] Executing AnalyzeForSlate on folder with color '{marker_color_name}'")
                success = folder.AnalyzeForSlate(color_const)
                
            self._send_response(200, {"success": success})
        except Exception as e:
            self._send_response(500, {"error": str(e), "traceback": traceback.format_exc()})

    def handle_generate_speech(self, params):
        resolve = get_resolve()
        if not resolve:
            self._send_response(503, {"error": "DaVinci Resolve is not running"})
            return
            
        settings = params.get("speechGenerationSettings", {})
        timecode = params.get("timecode", "01:00:00:00")
        
        proj = get_current_project()
        if not proj:
            self._send_response(400, {"error": "No project is currently loaded"})
            return
            
        try:
            print(f"[bridge] Executing GenerateSpeech with text='{settings.get('TextInput', '')[:30]}...' at timecode={timecode}")
            new_clip = proj.GenerateSpeech(settings, timecode)
            if new_clip:
                self._send_response(200, {
                    "success": True, 
                    "clipName": new_clip.GetName(),
                    "uniqueId": new_clip.GetUniqueId()
                })
            else:
                self._send_response(200, {
                    "success": False,
                    "error": "GenerateSpeech returned None. Check if required voice model / packages are installed."
                })
        except Exception as e:
            self._send_response(500, {"error": str(e), "traceback": traceback.format_exc()})

    def handle_assemble_timeline(self, params):
        print(f"[bridge] assemble-timeline params: {params}")
        resolve = get_resolve()
        if not resolve:
            self._send_response(503, {"error": "DaVinci Resolve is not running"})
            return
            
        pm = resolve.GetProjectManager()
        if not pm:
            self._send_response(503, {"error": "Project Manager not available"})
            return
            
        proj = pm.GetCurrentProject()
        if not proj:
            self._send_response(400, {"error": "No project is currently loaded"})
            return
            
        mp = proj.GetMediaPool()
        if not mp:
            self._send_response(400, {"error": "Media pool not available"})
            return
            
        timeline_name = params.get("timelineName", "Autogen_Beat_Cut_Timeline")
        clips_to_add = params.get("clips", []) # Array of dicts: {"filePath": str, "startFrame": int, "endFrame": int}
        lut_path = params.get("lutPath", None)
        watermark_path = params.get("watermarkPath", None)
        watermark_duration_frames = params.get("watermarkDurationFrames", None)
        
        try:
            # 1. Create or get timeline
            timeline = None
            # Find if timeline already exists
            num_timelines = proj.GetTimelineCount()
            for i in range(1, num_timelines + 1):
                t = proj.GetTimelineByIndex(i)
                if t and t.GetName() == timeline_name:
                    timeline = t
                    proj.SetCurrentTimeline(t)
                    break
                    
            if not timeline:
                timeline = mp.CreateEmptyTimeline(timeline_name)
                proj.SetCurrentTimeline(timeline)
                print(f"[bridge] Created new timeline: {timeline_name}")
                
            # 2. Ingest and append clips
            media_storage = resolve.GetMediaStorage()
            appended_count = 0
            total_duration_frames = 0
            
            # Refresh LUT list in Resolve if a LUT is specified
            if lut_path:
                try:
                    print("[bridge] Refreshing Resolve LUT list...")
                    proj.RefreshLUTList()
                except Exception as re:
                    print(f"[bridge] Warning: Could not refresh LUT list: {re}")
            
            for clip_info in clips_to_add:
                filepath = clip_info.get("filePath")
                start_frame = clip_info.get("startFrame")
                end_frame = clip_info.get("endFrame")
                
                exists = os.path.exists(filepath)
                print(f"[bridge] Processing clip: {filepath} (exists={exists})")
                if not filepath or not exists:
                    print(f"[bridge] Warning: File not found: {filepath}")
                    continue
                    
                # Import into media pool
                imported_items = media_storage.AddItemListToMediaPool([filepath])
                print(f"[bridge] AddItemListToMediaPool returned: {imported_items}")
                if not imported_items:
                    print(f"[bridge] Failed to import: {filepath}")
                    continue
                    
                media_pool_item = imported_items[0]
                
                # Retrieve clip start frame offset to handle camera non-zero start timecodes
                clip_properties = media_pool_item.GetClipProperty() or {}
                start_val = clip_properties.get("Start", "0")
                try:
                    offset = int(start_val)
                except (ValueError, TypeError):
                    offset = 0
                
                print(f"[bridge] Clip '{media_pool_item.GetName()}' properties - Start: '{start_val}', offset determined: {offset}")

                # Assemble append options
                append_options = {"mediaPoolItem": media_pool_item}
                if start_frame is not None:
                    append_options["startFrame"] = offset + int(start_frame)
                    # Track added frames for watermark length
                    if end_frame is not None:
                        total_duration_frames += (int(end_frame) - int(start_frame))
                if end_frame is not None:
                    append_options["endFrame"] = offset + int(end_frame)
                    
                success = mp.AppendToTimeline([append_options])
                print(f"[bridge] AppendToTimeline returned: {success}")
                if success:
                    appended_count += 1
                    print(f"[bridge] Successfully appended clip. Current appended_count: {appended_count}")
                    
                    # Apply LUT to the appended clip if specified
                    if lut_path and os.path.exists(lut_path):
                        if isinstance(success, list) and len(success) > 0:
                            timeline_item = success[0]
                            try:
                                # Determine relative LUT path relative to Resolve standard LUT directory
                                actual_lut_path = lut_path
                                standard_lut_dir = r"C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\LUT"
                                if lut_path.lower().startswith(standard_lut_dir.lower()):
                                    actual_lut_path = os.path.relpath(lut_path, standard_lut_dir)
                                else:
                                    brand_lut_filename = os.path.basename(lut_path)
                                    standard_copied_path = os.path.join(standard_lut_dir, "The Barnstorm", brand_lut_filename)
                                    if os.path.exists(standard_copied_path):
                                        actual_lut_path = os.path.join("The Barnstorm", brand_lut_filename)
                                
                                print(f"[bridge] Applying LUT to clip node 1: '{actual_lut_path}'")
                                lut_success = timeline_item.SetLUT(1, actual_lut_path)
                                print(f"[bridge] SetLUT returned: {lut_success}")
                            except Exception as le:
                                print(f"[bridge] Error setting LUT on clip: {le}")
                else:
                    print(f"[bridge] AppendToTimeline failed for clip: {filepath}")
                    
            # 3. Add watermark/logo overlay on Video Track 2 if specified
            if appended_count > 0 and watermark_path and os.path.exists(watermark_path):
                print(f"[bridge] Adding watermark overlay: {watermark_path}")
                
                # Ensure Video Track 2 exists
                try:
                    track_count = int(timeline.GetTrackCount("video"))
                    print(f"[bridge] Current video track count before watermark: {track_count}")
                    while track_count < 2:
                        timeline.AddTrack("video")
                        track_count = int(timeline.GetTrackCount("video"))
                        print(f"[bridge] Added video track. New count: {track_count}")
                except Exception as te:
                    print(f"[bridge] Error ensuring Video Track 2 exists: {te}")
                
                imported_watermarks = media_storage.AddItemListToMediaPool([watermark_path])
                print(f"[bridge] AddItemListToMediaPool for watermark returned: {imported_watermarks}")
                if imported_watermarks:
                    watermark_item = imported_watermarks[0]
                    wm_duration = watermark_duration_frames or total_duration_frames or 720 # 30s fallback
                    watermark_options = {
                        "mediaPoolItem": watermark_item,
                        "trackIndex": 2, # Video Track 2
                        "recordFrame": 0,
                        "startFrame": 0,
                        "endFrame": int(wm_duration)
                    }
                    wm_success = mp.AppendToTimeline([watermark_options])
                    print(f"[bridge] Watermark AppendToTimeline returned: {wm_success}")
                    
            self._send_response(200, {
                "success": True,
                "timelineName": timeline_name,
                "appendedCount": appended_count,
                "watermarkAdded": (watermark_path is not None and os.path.exists(watermark_path))
            })
        except Exception as e:
            self._send_response(500, {"error": str(e), "traceback": traceback.format_exc()})

    def handle_execute(self, params):
        code = params.get("code", "")
        print(f"[bridge] Executing custom code: {code[:100]}...")
        local_vars = {
            "resolve": get_resolve(),
            "dvr_script": dvr_script,
            "get_current_project": get_current_project,
            "get_current_folder": get_current_folder,
            "params": params.get("args", {})
        }
        try:
            import io
            import sys
            stdout = io.StringIO()
            stderr = io.StringIO()
            old_stdout = sys.stdout
            old_stderr = sys.stderr
            sys.stdout = stdout
            sys.stderr = stderr
            try:
                exec(code, globals(), local_vars)
            finally:
                sys.stdout = old_stdout
                sys.stderr = old_stderr
            self._send_response(200, {
                "success": True,
                "stdout": stdout.getvalue(),
                "stderr": stderr.getvalue(),
                "result": local_vars.get("result", None)
            })
        except Exception as e:
            self._send_response(500, {
                "error": str(e),
                "traceback": traceback.format_exc()
            })

def run(server_class=HTTPServer, handler_class=ResolveBridgeRequestHandler, port=5105):
    server_address = ("0.0.0.0", port)
    httpd = server_class(server_address, handler_class)
    print(f"[bridge] DaVinci Resolve Beta V6 Bridge running on port {port}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        print("[bridge] Bridge server stopped.")

if __name__ == "__main__":
    port_arg = 5105
    if len(sys.argv) > 1:
        try:
            port_arg = int(sys.argv[1])
        except ValueError:
            pass
    run(port=port_arg)
