#!/usr/bin/env python3
"""
CORTEX CortexPulse - Dynamic Foley & Sound Synthesis Engine
===========================================================
Procedurally synthesizes high-fidelity digital sound effects (cinematic sub-drops,
sci-fi laser sweeps, UI ticks, and wind sweeps) using pure Python mathematical models.
Saves outputs as valid PCM WAV files onto the NAS media directory and registers Codex notes.
"""

import os
import sys
import math
import wave
import struct
import argparse
from datetime import datetime, timezone

ACADEMY_CODEX_DIR = r"y:\creative-liberation-engine\academy\codex\cortex-pulse"
NAS_RAG_DATA = r"\\127.0.0.1\docker\creative-liberation-engine\media_intake\Sovereign_Academy_RAG\CortexPulse"

SAMPLE_RATE = 44100  # 44.1 kHz standard studio CD quality

def ensure_directories():
    os.makedirs(ACADEMY_CODEX_DIR, exist_ok=True)
    os.makedirs(NAS_RAG_DATA, exist_ok=True)

def write_wav_file(file_path: str, samples: list):
    """Writes a list of floating point audio samples (-1.0 to 1.0) as 16-bit mono PCM WAV"""
    with wave.open(file_path, 'wb') as wav:
        wav.setnchannels(1)      # Mono
        wav.setsampwidth(2)      # 16-bit PCM (2 bytes)
        wav.setframerate(SAMPLE_RATE)
        
        packed_data = []
        for s in samples:
            # Clip sample values to prevent wrapping overflow
            s = max(-1.0, min(1.0, s))
            # Convert to signed 16-bit integer
            int_sample = int(s * 32767)
            packed_data.append(struct.pack('<h', int_sample))
            
        wav.writeframes(b"".join(packed_data))
    print(f"  [+] Synthesized WAV file written to {file_path}")

def synthesize_sub_drop(duration: float = 3.0) -> list:
    """Generates a deep cinematic bass sub-drop sweeping from 120Hz down to 25Hz"""
    num_samples = int(SAMPLE_RATE * duration)
    samples = []
    
    start_freq = 120.0
    end_freq = 25.0
    
    phase = 0.0
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        progress = t / duration
        
        # Exponential frequency sweep
        freq = start_freq * ((end_freq / start_freq) ** progress)
        
        # Sine wave generator
        sample = math.sin(phase)
        phase += 2 * math.pi * freq / SAMPLE_RATE
        
        # Exponential volume envelope (smooth fade-out)
        envelope = math.exp(-3.5 * progress)
        # Prevent harsh pop at start (short fade-in)
        if t < 0.05:
            envelope *= (t / 0.05)
            
        samples.append(sample * envelope * 0.8)
    return samples

def synthesize_cyber_laser(duration: float = 0.8) -> list:
    """Generates a dynamic FM sci-fi cybernetic laser sweep"""
    num_samples = int(SAMPLE_RATE * duration)
    samples = []
    
    phase = 0.0
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        progress = t / duration
        
        # Sweeping carrier frequency
        carrier_freq = 1800.0 * (1.0 - progress) + 300.0
        # Modulating frequency
        mod_freq = 150.0 * (1.0 - progress)
        # Modulating index (FM depth)
        mod_index = 8.0 * (1.0 - progress)
        
        mod_val = math.sin(2 * math.pi * mod_freq * t) * mod_index
        sample = math.sin(phase + mod_val)
        
        phase += 2 * math.pi * carrier_freq / SAMPLE_RATE
        
        # Exponential volume envelope
        envelope = (1.0 - progress) * math.exp(-2.0 * progress)
        samples.append(sample * envelope * 0.7)
    return samples

def synthesize_ui_click(duration: float = 0.1) -> list:
    """Generates a high-frequency micro-acoustic metallic UI click with decay echo"""
    num_samples = int(SAMPLE_RATE * duration)
    samples = []
    
    phase_carrier = 0.0
    phase_mod = 0.0
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        progress = t / duration
        
        # Double frequency synth
        carrier = math.sin(phase_carrier)
        modulator = math.sin(phase_mod)
        
        phase_carrier += 2 * math.pi * 3200.0 / SAMPLE_RATE
        phase_mod += 2 * math.pi * 850.0 / SAMPLE_RATE
        
        sample = (carrier * 0.6) + (modulator * 0.4)
        # Fast exponential decay envelope
        envelope = math.exp(-25.0 * progress)
        
        # Digital echo simulator
        echo_delay = 0.02 # 20ms
        echo_val = 0.0
        if t > echo_delay:
            echo_index = int((t - echo_delay) * SAMPLE_RATE)
            if echo_index < len(samples):
                echo_val = samples[echo_index] * 0.35 # Feed-back gain
                
        samples.append((sample * envelope * 0.6) + echo_val)
    return samples

def synthesize_wind_shosh(duration: float = 4.0) -> list:
    """Generates a white noise sweeping filter representing cinematic wind or sound design transition"""
    num_samples = int(SAMPLE_RATE * duration)
    samples = []
    
    # Pseudo-random white noise generation
    import random
    
    # Simple lowpass state variables
    lp_state = 0.0
    
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        progress = t / duration
        
        # Pure white noise sample
        noise = random.uniform(-1.0, 1.0)
        
        # Dynamically sweep the filter coefficient to simulate rising wind gusts
        cutoff = 0.01 + 0.12 * math.sin(math.pi * progress) # sweeps up and down
        
        # First-order low-pass filter
        lp_state += cutoff * (noise - lp_state)
        sample = lp_state
        
        # Fade envelope
        envelope = math.sin(math.pi * progress) # smooth dome fade in/out
        samples.append(sample * envelope * 0.9)
    return samples

def write_obsidian_foley_note(title: str, effect_type: str, duration: float, wav_path: str):
    memory_id = f"mem_cortex_pulse_{title.lower().replace(' ', '_')}"
    current_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    frontmatter = f"""---
memoryId: "{memory_id}"
kind: "artifact"
title: "CortexPulse Foley: {title}"
summary: "Synthesized 44.1kHz studio WAV audio effect: {effect_type}"
source: "KI"
provenance:
  recordedBy: "cortex_pulse_synthesizer"
  recordedAt: "{current_time}"
confidence: 1.0
retentionClass: "canonical"
tags:
  - "cortex-pulse"
  - "procedural-audio"
  - "foley-generator"
  - "sound-design"
createdAt: "{current_time}"
updatedAt: "{current_time}"
lifecycleState: "active"
---

# CortexPulse Foley: {title}

**Procedural Sound Type:** `{effect_type}`
**Duration**: `{duration:.2f} seconds`
**Audio Output File Path:** `{wav_path}`
**Synthesized At:** `{current_time}`

## Synthesis Telemetry & Parameters
* **Sample Rate**: 44,100 Hz (Mono, 16-bit PCM WAV)
* **Frequency Range**: Sweeping dynamic bandwidth
* **Waveform Synthesis Engine**: Cortex Math Synth V6

## Ingestion Summary
> [!TIP]
> This foley sound effect is staged directly on the NAS storage cluster.
> It can be mounted instantly into your DaVinci Resolve active edit tracks or sound libraries.
"""
    note_path = os.path.join(ACADEMY_CODEX_DIR, f"{title.lower().replace(' ', '_')}.md")
    with open(note_path, 'w', encoding='utf-8') as f:
        f.write(frontmatter)
    print(f"  [+] Saved CortexPulse Obsidian Note to {note_path}")

def run_foley_synthesis(effect_type: str, title: str = "Synthesized Foley", duration: float = 2.0):
    ensure_directories()
    print(f"[*] CortexPulse: Initiating synthesis routine for '{effect_type}'...")
    
    effect_type_lc = effect_type.lower()
    
    if "drop" in effect_type_lc or "bass" in effect_type_lc:
        samples = synthesize_sub_drop(duration if duration > 0 else 3.0)
        effect_name = "Cinematic Bass Sub-Drop"
    elif "laser" in effect_type_lc or "sweep" in effect_type_lc:
        samples = synthesize_cyber_laser(duration if duration > 0 else 0.8)
        effect_name = "FM Cyber Laser Sweep"
    elif "click" in effect_type_lc or "tick" in effect_type_lc:
        samples = synthesize_ui_click(duration if duration > 0 else 0.1)
        effect_name = "Metallic UI Micro-Click"
    else:
        samples = synthesize_wind_shosh(duration if duration > 0 else 4.0)
        effect_name = "Procedural White Noise Wind Gust"
        
    wav_filename = f"{title.lower().replace(' ', '_')}.wav"
    output_wav_path = os.path.join(NAS_RAG_DATA, wav_filename)
    
    write_wav_file(output_wav_path, samples)
    write_obsidian_foley_note(title, effect_name, len(samples) / SAMPLE_RATE, output_wav_path)
    print(f"[*] CortexPulse: Synthesis routine successfully completed!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CortexPulse Foley & Audio Synthesizer")
    parser.add_argument("type", help="Sound type (sub_drop, laser, click, wind)")
    parser.add_argument("--title", default="Procedural FX", help="Sound name/title")
    parser.add_argument("--duration", type=float, default=0.0, help="Sound duration in seconds")
    args = parser.parse_args()
    
    run_foley_synthesis(args.type, title=args.title, duration=args.duration)
