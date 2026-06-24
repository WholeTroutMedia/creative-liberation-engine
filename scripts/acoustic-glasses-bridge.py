import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wav
import speech_recognition as sr
import requests
import time
import os

# CLE Spatial OS Bridge URLs
SPATIAL_GATEWAY_URL = "http://localhost:5106"
PUSH_LAYOUT_ENDPOINT = f"{SPATIAL_GATEWAY_URL}/api/layout/push"
TEMP_WAV_PATH = "y:\\creative-liberation-engine\\scratch\\temp_glasses.wav"

print("=======================================================")
print("  [Mic]  CLE Spatial OS Bridge - Direct Acoustic ")
print("=======================================================")

# Ensure scratch directory exists
os.makedirs("y:\\creative-liberation-engine\\scratch", exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# 1. DETECT THE PHYSICAL GLASSES MICROPHONE NODE
# ─────────────────────────────────────────────────────────────────────────────

print("[Acoustic] Scanning system input interfaces...")
devices = sd.query_devices()
glasses_device_index = None

for idx, device in enumerate(devices):
    name = device['name']
    hostapi_idx = device['hostapi']
    hostapi_name = sd.query_hostapis(hostapi_idx)['name']
    
    if "RB Meta" in name or "Meta" in name or "Glasses" in name:
        if device['max_input_channels'] > 0:
            # Skip WDM-KS interfaces to avoid PortAudio 'Blocking API not supported yet' exceptions
            if "WDM-KS" in hostapi_name:
                print(f"  - Skipping WDM-KS interface: '{name}' [Device Index: {idx}]")
                continue
                
            glasses_device_index = idx
            print(f"* [FOUND] Smart Glasses Mic: '{name}' (via {hostapi_name}) [Device Index: {idx}]")
            break

if glasses_device_index is None:
    # Fallback to default input device index
    glasses_device_index = sd.default.device[0]
    print(f"[Warning] Ray-Ban Meta microphone not found in active list.")
    print(f"  - Falling back to default system input index: {glasses_device_index}")

# ─────────────────────────────────────────────────────────────────────────────
# 2. DEFINE DYNAMIC HUD AST LAYOUTS (Matching V6 Pitch Black Brutalist design)
# ─────────────────────────────────────────────────────────────────────────────

LAYOUTS = {
    "INGEST_ACTIVE": {
        "layout_id": "lens_ingest",
        "render_commands": [
            {
                "type": "CONTAINER",
                "style": "brutalist_pink_alert",
                "position": { "x": "2%", "y": "2%", "width": "20%", "height": "10%" },
                "children": [
                    { "type": "TEXT", "content": "COGNITIVE INGEST ACTIVE", "style": "brutalist_pink_title" },
                    { "type": "TEXT", "content": "STREAMING VOICE DATA TO SPINE...", "style": "gray_subtitle" }
                ]
            },
            {
                "type": "SCREEN_GRID",
                "style": "composition_rule_of_thirds",
                "color": "rgba(255, 51, 102, 0.4)"
            }
        ]
    },
    "SAM3D_TRACKING": {
        "layout_id": "lens_sam3d",
        "render_commands": [
            {
                "type": "CONTAINER",
                "style": "glassmorphism",
                "position": { "x": "2%", "y": "2%", "width": "22%", "height": "12%" },
                "children": [
                    { "type": "TEXT", "content": "SAM 3D OBJECTS ACTIVE", "style": "neon_cyan_title" },
                    { "type": "TEXT", "content": "PRE-SEGMENTING POVS IN MESH...", "style": "gray_subtitle" }
                ]
            },
            {
                "type": "SPATIAL_MARKER",
                "target_pose": { "yaw": 142.5, "pitch": -10.2 },
                "label": "[SAM_BODY_TARGET_07]",
                "color": "#00FFCC"
            },
            {
                "type": "SPATIAL_MARKER",
                "target_pose": { "yaw": 146.1, "pitch": -8.5 },
                "label": "[SAM_TRACK_PERFORMANCE]",
                "color": "#FF3366"
            }
        ]
    },
    "SUCCESS": {
        "layout_id": "ingest_success",
        "render_commands": [
            {
                "type": "CONTAINER",
                "style": "success_green",
                "position": { "x": "2%", "y": "2%", "width": "18%", "height": "8%" },
                "children": [
                    { "type": "TEXT", "content": "NODE INDEXED", "style": "success_green_title" },
                    { "type": "TEXT", "content": "MEMORY SPINE SAVED SUCCESSFULLY", "style": "gray_subtitle" }
                ]
            }
        ]
    },
    "RESET": {
        "layout_id": "lens_idle",
        "render_commands": [
            {
                "type": "CONTAINER",
                "style": "glassmorphism",
                "position": { "x": "2%", "y": "2%", "width": "15%", "height": "8%" },
                "children": [
                    { "type": "TEXT", "content": "LENS SOVEREIGN", "style": "neon_green_title" },
                    { "type": "TEXT", "content": "SYS STATUS: NOMINAL", "style": "gray_subtitle" }
                ]
            }
        ]
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. VOICE ACTIVITY DETECTION & RECORDER (sounddevice-based)
# ─────────────────────────────────────────────────────────────────────────────

SAMPLE_RATE = 16000 # 16kHz Mono optimal for ASR
BLOCK_SIZE = 1024
THRESHOLD = 0.015   # Noise energy threshold (calibrated below)
SILENCE_LIMIT = 1.5 # Seconds of silence before stopping

print("[Acoustic] Calibrating energy threshold for background noise...")
# Calibrate threshold by reading 1 second of audio
calibration_stream = sd.InputStream(device=glasses_device_index, channels=1, samplerate=SAMPLE_RATE, blocksize=BLOCK_SIZE)
with calibration_stream:
    time.sleep(1.0)
    data, overflow = calibration_stream.read(SAMPLE_RATE)
    rms = np.sqrt(np.mean(data**2))
    THRESHOLD = max(rms * 2.2, 0.0022) # Lower hard-minimum for pro USB interfaces

print(f"[Acoustic] Calibration completed! Active energy threshold: {THRESHOLD:.4f}")
print("\n[LISTENING] Acoustic Bridge is active! Speak commands into your glasses:")
print(" - 'ingest / save / index' -> Triggers Memory Ingest mode")
print(" - 'sam / track / segment' -> Triggers SAM 3D live segment overlay")
print(" - 'reset / clear / idle'   -> Resets HUD to Nominal status")
print(" - 'exit'                   -> Closes the bridge")
print("----------------------------------------------------------------")

r = sr.Recognizer()

# ─────────────────────────────────────────────────────────────────────────────
# 4. ACTIVE STREAM & PROCESSING LOOP
# ─────────────────────────────────────────────────────────────────────────────

try:
    consecutive_errors = 0
    while True:
        audio_buffer = []
        is_recording = False
        silence_start = None
        record_start = None
        consecutive_trigger_count = 0
        
        print(f"\n[Mic] Starting stream...")
        
        # Open the high-performance sounddevice stream
        stream = sd.InputStream(device=glasses_device_index, channels=1, samplerate=SAMPLE_RATE, blocksize=BLOCK_SIZE)
        with stream:
            while True:
                # Read block of audio data
                data, overflow = stream.read(BLOCK_SIZE)
                rms = np.sqrt(np.mean(data**2))
                
                if not is_recording:
                    # Dynamic visual level feedback meter
                    bars = int(min(rms * 1000, 30))
                    meter = "=" * bars + "." * (30 - bars)
                    print(f"\r[Listening] [{meter}] RMS: {rms:.5f} | Trigger Target: {THRESHOLD:.5f} ", end="", flush=True)
                    
                    if rms > THRESHOLD:
                        consecutive_trigger_count += 1
                        # Require 2 consecutive blocks to filter transient noise pops
                        if consecutive_trigger_count >= 2:
                            print("\n[Mic] Voice Activity Detected! Recording...")
                            is_recording = True
                            record_start = time.time()
                            audio_buffer.extend(data.flatten())
                    else:
                        consecutive_trigger_count = 0
                else:
                    audio_buffer.extend(data.flatten())
                    
                    # Dynamic visual recording level feedback meter
                    bars = int(min(rms * 1000, 30))
                    meter = "!" * bars + "." * (30 - bars)
                    print(f"\r[Recording] [{meter}] RMS: {rms:.5f} | Hard-limit: {time.time() - record_start:.1f}s/6.0s ", end="", flush=True)
                    
                    # Hard duration limit of 6 seconds per vocal command to prevent infinite loops
                    if time.time() - record_start > 6.0:
                        print("\n[Mic] Maximum command duration reached (6.0s). Finalizing buffer.")
                        break
                        
                    if rms < THRESHOLD:
                        if silence_start is None:
                            silence_start = time.time()
                        elif time.time() - silence_start > SILENCE_LIMIT:
                            # User stopped speaking, finalize buffer
                            print("\n[Mic] Silence detected. Stop recording.")
                            break
                    else:
                        silence_start = None
                        
        if len(audio_buffer) > SAMPLE_RATE * 0.5: # Only process if audio is > 0.5 seconds
            print("[Acoustic] Voice complete. Saving temporary WAV file...")
            pcm_data = (np.array(audio_buffer) * 32767).astype(np.int16)
            wav.write(TEMP_WAV_PATH, SAMPLE_RATE, pcm_data)
            
            print("[Acoustic] Transcribing locally via speech engine...")
            try:
                with sr.AudioFile(TEMP_WAV_PATH) as source:
                    audio_data = r.record(source)
                
                command_text = r.recognize_google(audio_data)
                print(f"I Heard: \"{command_text}\"")
                
                consecutive_errors = 0 # Reset error climber
                
                normalized = command_text.lower()
                if "exit" in normalized:
                    print("Closing acoustic bridge.")
                    break
                    
                # Pipe pure natural language directly to Spatial OS express server for fuzzy mapping
                requests.post(PUSH_LAYOUT_ENDPOINT, json={"voice_command": command_text})
                
            except sr.UnknownValueError:
                print("No speech detected or audio unclear.")
                consecutive_errors += 1
                # Auto-climb the noise floor threshold if 3 consecutive blank clips are recorded
                if consecutive_errors >= 3:
                    THRESHOLD += 0.003
                    print(f"[Acoustic] Static detected. Escalating noise energy threshold to: {THRESHOLD:.4f}")
                    consecutive_errors = 0
            except sr.RequestError as e:
                print(f"Error: ASR request failed: {e}")
            except Exception as e:
                print(f"Error executing command: {e}")
                
except KeyboardInterrupt:
    print("\nAcoustic bridge closed by user.")
finally:
    # Clean up temp file
    if os.path.exists(TEMP_WAV_PATH):
        try:
            os.remove(TEMP_WAV_PATH)
        except:
            pass
