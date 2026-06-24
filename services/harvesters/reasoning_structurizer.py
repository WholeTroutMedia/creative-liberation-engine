#!/usr/bin/env python3
"""
Reasoning Structurizer — GPU-Aware Inference Router
=====================================================
Converts raw harvested text into structured Expert Reasoning Chains (JSON).

GPU Resource Management:
  1. Checks if GPU-heavy apps (DaVinci Resolve, Unreal, Blender, etc.) are running
  2. If GPU is BUSY  → routes to Gemini API (cloud fallback)
  3. If GPU is FREE  → starts Ollama, loads gemma4:26b, runs local inference, then releases
  4. After local inference completes → optionally unloads model to free VRAM

This prevents the catastrophic resource contention that happens when a 17GB LLM
tries to share a 24GB GPU with a DaVinci render.
"""

from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.request
import urllib.error

# ─── Configuration ───────────────────────────────────────────────────────────

# Local Ollama
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_TAGS_URL = "http://localhost:11434/api/tags"
LOCAL_MODEL = "gemma4:26b"

# Cloud fallback — Gemini via Google AI Studio
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    # Fallback: read from .env files
    for env_path in [
        os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
        os.path.join(os.path.dirname(__file__), "..", "genkit", ".env"),
    ]:
        env_path = os.path.normpath(env_path)
        if os.path.isfile(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    if line.strip().startswith("GEMINI_API_KEY=") and "=" in line:
                        val = line.strip().split("=", 1)[1].strip()
                        val = val.strip('\"\'')
                        if val:
                            GEMINI_API_KEY = val
                            break
            if GEMINI_API_KEY:
                break
GEMINI_MODEL = os.getenv("MODEL_CLOUD_FAST", "gemini-2.5-flash")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# GPU-heavy processes that should block local inference
GPU_HEAVY_PROCESSES = [
    "Resolve",              # DaVinci Resolve
    "fuscript",             # Fusion (DaVinci sub-process)
    "DaVinciPanelDaemon",   # DaVinci panel daemon
    "UnrealEditor",         # Unreal Engine
    "blender",              # Blender
    "AfterFX",              # After Effects
    "Premiere Pro",         # Premiere Pro
    "nuke",                 # Foundry Nuke
    "ComfyUI",              # ComfyUI (Stable Diffusion)
    "kohya_ss",             # LoRA training
]

# ─── GPU Awareness ───────────────────────────────────────────────────────────

def is_gpu_busy() -> tuple[bool, list[str]]:
    """
    Check if any GPU-heavy applications are running.
    Returns (is_busy, list_of_detected_processes).
    """
    detected = []
    try:
        import sys
        if sys.platform.startswith("win"):
            result = subprocess.run(
                ["powershell", "-Command",
                 "Get-Process | Select-Object -ExpandProperty ProcessName"],
                capture_output=True, text=True, timeout=10
            )
            running = set(result.stdout.strip().split("\n"))
        else:
            import shutil
            ps_cmd = shutil.which("ps")
            if not ps_cmd:
                for path in ["/usr/bin/ps", "/bin/ps"]:
                    if os.path.exists(path):
                        ps_cmd = path
                        break
            if not ps_cmd:
                raise FileNotFoundError("ps command not found")
                
            result = subprocess.run(
                [ps_cmd, "-ax", "-o", "comm="],
                capture_output=True, text=True, timeout=10
            )
            running = set(line.strip() for line in result.stdout.strip().split("\n") if line.strip())
            
        for proc in GPU_HEAVY_PROCESSES:
            proc_lower = proc.lower()
            if any(proc_lower in r.lower() for r in running):
                detected.append(proc)
    except Exception as e:
        print(f"[!] GPU check failed: {e} — assuming busy for safety")
        return True, ["unknown (check failed)"]

    return len(detected) > 0, detected



def get_vram_free_mb() -> int:
    """Query nvidia-smi for free VRAM in MB. Returns -1 on failure."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.free", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5
        )
        return int(result.stdout.strip())
    except Exception:
        return -1


# ─── Ollama Lifecycle ────────────────────────────────────────────────────────

def is_ollama_running() -> bool:
    """Check if Ollama API is responding."""
    try:
        req = urllib.request.Request(OLLAMA_TAGS_URL)
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def is_model_available() -> bool:
    """Check if Ollama API is responding and the target model is available."""
    try:
        req = urllib.request.Request(OLLAMA_TAGS_URL)
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode('utf-8'))
                models = [m.get('name') for m in data.get('models', [])]
                return any(LOCAL_MODEL in m or m in LOCAL_MODEL for m in models)
    except Exception:
        pass
    return False



def start_ollama():
    """Start Ollama server if not already running."""
    if is_ollama_running():
        print("[*] Ollama already running")
        return True

    print("[*] Starting Ollama server...")
    try:
        subprocess.Popen(
            ["ollama", "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        # Wait for server to come up
        for attempt in range(15):
            time.sleep(2)
            if is_ollama_running():
                print(f"[+] Ollama server started (attempt {attempt + 1})")
                # Warm up the model into VRAM
                print(f"[*] Warming up {LOCAL_MODEL} into VRAM...")
                try:
                    warmup_payload = json.dumps({
                        "model": LOCAL_MODEL,
                        "prompt": "hi",
                        "stream": False
                    }).encode()
                    warmup_req = urllib.request.Request(
                        OLLAMA_URL, data=warmup_payload,
                        headers={"Content-Type": "application/json"}
                    )
                    with urllib.request.urlopen(warmup_req, timeout=600) as warmup_resp:
                        warmup_result = json.loads(warmup_resp.read())
                        print(f"[+] Model warm: {warmup_result.get('response', '?')[:30]}")
                except Exception as warmup_e:
                    print(f"[!] Warm-up failed: {warmup_e}")
                    return False
                return True
        print("[!] Ollama failed to start within 30 seconds")
        return False
    except FileNotFoundError:
        print("[!] Ollama binary not found in PATH")
        return False


def stop_ollama():
    """Kill Ollama to release VRAM."""
    print("[*] Stopping Ollama to release VRAM...")
    try:
        subprocess.run(
            ["powershell", "-Command", "Stop-Process -Name 'ollama' -Force -ErrorAction SilentlyContinue"],
            capture_output=True, timeout=10
        )
        time.sleep(2)
        free = get_vram_free_mb()
        print(f"[+] Ollama stopped. VRAM free: {free} MB")
    except Exception as e:
        print(f"[!] Error stopping Ollama: {e}")


# ─── Inference Backends ──────────────────────────────────────────────────────

def _call_ollama(prompt: str) -> str:
    """Call local Ollama with gemma4:26b."""
    payload = {
        "model": LOCAL_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    # 5 minute timeout — cold load of 17GB model takes time
    with urllib.request.urlopen(req, timeout=300) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result.get('response', '[]')


def _call_gemini(prompt: str) -> str:
    """Call Gemini API as cloud fallback."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not set — cannot use cloud fallback")

    url = f"{GEMINI_URL}?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        result = json.loads(response.read().decode('utf-8'))
        # Extract text from Gemini response structure
        candidates = result.get('candidates', [])
        if candidates:
            parts = candidates[0].get('content', {}).get('parts', [])
            if parts:
                return parts[0].get('text', '[]')
    return '[]'


# ─── Prompt Template ─────────────────────────────────────────────────────────

PROMPT_TEMPLATE = """
You are an expert pipeline architect for the Creative Liberation Engine. 
Extract any technical workflows, code snippets, or API usage from the following raw documentation text.
Structure your extraction into a valid JSON array of objects. Each object MUST have the following keys exactly:
- "problem": A description of the task or issue being solved.
- "approach_a": The first, perhaps naive or standard way to solve it.
- "approach_b": An alternative, optimized, or expert way to solve it.
- "solution": The final recommended code or workflow steps.

If no clear workflow is present, return an empty array [].
DO NOT wrap the JSON in markdown code blocks. Output ONLY raw JSON.

Raw Text to process:
{text}
"""

# ─── Main Entry Point ────────────────────────────────────────────────────────

def structurize_text_to_reasoning_chains(raw_text: str, chunk_size: int = 4000) -> list[dict]:
    """
    GPU-aware structurizer. Routes to local Ollama or cloud Gemini based on
    whether GPU-heavy apps are currently running.
    """
    print(f"[*] Structurizing {len(raw_text)} characters of raw text into reasoning chains...")

    # ── Step 1: GPU resource check ──
    gpu_busy, blockers = is_gpu_busy()
    use_local = False
    started_ollama = False

    if gpu_busy:
        print(f"[!] GPU BUSY — detected: {', '.join(blockers)}")
        print("[*] Routing to Gemini cloud fallback (GPU protected)")
        if not GEMINI_API_KEY:
            print("[!] GEMINI_API_KEY not set. Cannot proceed. Set env var or free GPU.")
            print("[!] To set: $env:GEMINI_API_KEY = 'your-key-here'")
            return []
    else:
        # If Ollama is already running, our model is probably already loaded
        # — the low VRAM reading is from OUR model, not a conflict.
        if is_model_available():
            print("[*] Ollama running and model is warm, using local inference")
            use_local = True
            started_ollama = False  # We didn't start it, don't kill it
        else:
            vram_free = get_vram_free_mb()
            print(f"[*] GPU FREE — {vram_free} MB VRAM available")
            if vram_free > 14000:  # Need ~14GB for gemma4:26b Q4_K_M
                started_ollama = start_ollama()
                if started_ollama and is_model_available():
                    use_local = True
                else:
                    print("[!] Ollama started but target model is not available locally. Falling back to Gemini.")
                    use_local = False
            else:
                print(f"[!] Insufficient VRAM or target model not available locally. Falling back to Gemini.")


    backend_name = "LOCAL (gemma4:26b)" if use_local else f"CLOUD ({GEMINI_MODEL})"
    print(f"[*] Inference backend: {backend_name}")

    # ── Step 2: Process chunks ──
    chunks = [raw_text[i:i + chunk_size] for i in range(0, len(raw_text), chunk_size)]
    structured_data = []

    for i, chunk in enumerate(chunks):
        print(f"[*] Processing chunk {i + 1}/{len(chunks)}...")
        prompt = PROMPT_TEMPLATE.format(text=chunk)

        try:
            if use_local:
                response_text = _call_ollama(prompt)
            else:
                response_text = _call_gemini(prompt)

            # Parse the JSON response
            try:
                chains = json.loads(response_text)
                if isinstance(chains, list):
                    structured_data.extend(chains)
                    print(f"  [+] Extracted {len(chains)} chains from chunk {i + 1}")
                elif isinstance(chains, dict):
                    # Single reasoning chain returned as a dict
                    if "problem" in chains:
                        structured_data.append(chains)
                        print(f"  [+] Extracted 1 chain from chunk {i + 1}")
                    else:
                        # Some models wrap in {"results": [...]}
                        found = False
                        for v in chains.values():
                            if isinstance(v, list):
                                structured_data.extend(v)
                                print(f"  [+] Extracted {len(v)} chains from chunk {i + 1}")
                                found = True
                                break
                        if not found:
                            structured_data.append(chains)
                            print(f"  [+] Extracted 1 raw chain from chunk {i + 1}")
            except json.JSONDecodeError:
                print(f"  [!] Warning: Chunk {i + 1} returned invalid JSON. Skipping.")

        except urllib.error.URLError as e:
            print(f"  [!] Connection error: {e}")
            if use_local:
                print("  [!] Local Ollama connection failed. Attempting Gemini fallback...")
                try:
                    response_text = _call_gemini(prompt)
                    chains = json.loads(response_text)
                    if isinstance(chains, list):
                        structured_data.extend(chains)
                except Exception as fallback_e:
                    print(f"  [!] Gemini fallback also failed: {fallback_e}")
            continue
        except Exception as e:
            print(f"  [!] Inference error on chunk {i + 1}: {e}")
            continue

    # ── Step 3: Cleanup ──
    if use_local and started_ollama:
        stop_ollama()

    return structured_data


def save_structured_data(data: list[dict], filepath: str):
    """Save structured reasoning chains to a JSON file."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print(f"[+] Saved {len(data)} structured reasoning chains to {filepath}")
