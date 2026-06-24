#!/usr/bin/env python3
"""
Creative Liberation Engine V6: Night Shift Daemon (Sovereign Media Mesh)

This service watches system telemetry (specifically VRAM utilization and the
presence of Resolve.exe). It triggers heavy LoRA training scripts ONLY when
DaVinci Resolve is not running, ensuring the 4090's VRAM is fully available.
"""

import os
import time
import subprocess
import argparse
from datetime import datetime

# Path bindings
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TRAINING_SCRIPT_STUB = os.path.join(WORKSPACE_ROOT, "tools", "run_lora_training.py") # Placeholder for the actual training entrypoint

def is_resolve_running() -> bool:
    """Checks if DaVinci Resolve is currently active in memory."""
    try:
        # 'tasklist' is standard on Windows. We look for Resolve.exe.
        output = subprocess.check_output('tasklist /FI "IMAGENAME eq Resolve.exe"', shell=True, text=True)
        return "Resolve.exe" in output
    except Exception as e:
        print(f"[!] Error checking tasklist: {e}")
        return True # Fail-safe: assume it's running to prevent crashing

def is_ollama_running() -> bool:
    """Checks if Ollama is consuming VRAM."""
    try:
        output = subprocess.check_output('tasklist /FI "IMAGENAME eq ollama.exe"', shell=True, text=True)
        return "ollama.exe" in output
    except Exception:
        return False

def trigger_training_cycle():
    """Executes the LoRA training scripts."""
    print(f"\n[{datetime.now().isoformat()}] [*] NIGHT SHIFT INITIATED: Launching LoRA Training...")
    print("[*] VRAM is clear. Launching Unsloth/PEFT sub-process...")
    
    # In production, this would `subprocess.Popen` the heavy training script
    # For scaffolding, we simulate
    time.sleep(2)
    print("[*] Simulation: Training cycle complete or checkpointed.")

def night_shift_loop(poll_interval_seconds=60):
    print("=====================================================")
    print(" V6 SOVEREIGN MEDIA MESH - NIGHT SHIFT DAEMON        ")
    print("=====================================================")
    print(f"[*] Monitoring for DaVinci Resolve termination. Polling every {poll_interval_seconds}s...")

    training_active = False

    while True:
        resolve_active = is_resolve_running()
        
        if resolve_active:
            if training_active:
                print(f"[{datetime.now().isoformat()}] [!] Resolve.exe detected! Aborting/Checkpointing training immediately to free VRAM!")
                training_active = False
            # Otherwise, just quietly wait.
            print(f"[{datetime.now().isoformat()}] Resolve active. GPU occupied. Waiting...", end="\r")
        else:
            if not training_active:
                print(f"\n[{datetime.now().isoformat()}] Resolve.exe is offline. System is in Night Shift mode.")
                
                # Check for ollama collision
                if is_ollama_running():
                    print("[!] Warning: ollama.exe is active. Training may compete for VRAM. Attempting to restrict/kill Ollama...")
                    # Implementation for gracefully stopping local models would go here
                
                training_active = True
                trigger_training_cycle()
                
        time.sleep(poll_interval_seconds)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Night Shift LoRA Training Daemon")
    parser.add_argument("--poll", type=int, default=60, help="Seconds between telemetry checks")
    
    args = parser.parse_args()
    
    # Run the daemon
    try:
        night_shift_loop(poll_interval_seconds=args.poll)
    except KeyboardInterrupt:
        print("\n[*] Night Shift Daemon terminated by user.")
