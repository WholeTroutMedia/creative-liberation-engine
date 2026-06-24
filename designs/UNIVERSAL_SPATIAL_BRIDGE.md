# 🕶️ Architecture Blueprint: Universal Spatial Bridge
## Project "Sovereign Lens" — Creative Liberation Engine Spatial Runtime

> **Author:** AVERI (ATHENA / VERA / IRIS)  
> **Stance:** INFRASTRUCTURE / CREATIVE DIRECTORS | **Priority:** Critical  
> **Target Document:** [UNIVERSAL_SPATIAL_BRIDGE.md](file:///y:/creative-liberation-engine/designs/UNIVERSAL_SPATIAL_BRIDGE.md)  
> **Core Thesis:** Do not build vertical, single-purpose smart glasses applications. Instead, construct a **general-purpose spatial thin-client runtime** that multiplexes raw edge telemetry (vision, audio, spatial sensors, gestures) directly to the Creative Liberation Engine Dispatch Server and dynamically renders declarative HUD layouts streamed from the NAS in real-time.

---

## 1. Architectural Philosophy

Building standalone, siloed vertical applications for smart glasses creates immediate developer lock-in and limits the platform's adaptability. To place Creative Liberation Engine at the absolute forefront of the spatial ecosystem, we establish **Sovereign Lens** as a **Universal Spatial OS Bridge**.

The smart glasses and paired mobile phone act purely as a **decoupled input/output terminal (thin client)**. All business logic, vision model parsing (SAM 3D, LLaVA, OCR), acoustic processing (Whisper), and database indexing (Memory Spine) reside entirely on the local NAS compute node. This ensures the edge platform remains completely open-minded, adaptable to any future model release, and highly performant.

```
+──────────────────────────────────────────────────────────────────────────────+
│                          SPATIAL EDGE LAYER (Thin Client)                    │
│                                                                              │
│    [ Ray-Ban Meta Glasses ]           [ Mobile Phone Proxy Gateway ]         │
│    - POV Video / Keyframe Feed ------> - Sensor Multiplexer & Router         │
│    - IMU, Compass, Gyro Telemetry ---> - Local Secure Encryption Buffer      │
│    - Voice & Acoustic Buffers --------> - Local WebSocket/WebRTC Gateway     │
│                                                   │                          │
│    - Dynamic HUD Frame Renderer <─────── - Decodes Server-Sent JSON Layouts  │
+───────────────────────────────────────────────────┼──────────────────────────+
                                                    │ (Bi-Directional Stream)
                                                    ▼
+──────────────────────────────────────────────────────────────────────────────+
│                        SOVEREIGN COMPUTE LAYER (Private NAS)                 │
│                                                                              │
│             [ Creative Liberation Engine Dispatch Server / Dynamic Router ]            │
│                                                                              │
│         ┌─────────────────────────┼──────────────────────────┐               │
│         ▼                         ▼                          ▼               │
│   [ Vision Mesh ]         [ Acoustic Mesh ]         [ Task Swarm ]           │
│   - SAM 3D, Qwen-VL       - local Whisper           - Dispatch queue         │
│   - NeRF Splatting        - Voice Triage            - CORTEX bridge          │
│         │                         │                          │               │
│         └─────────────────────────┼──────────────────────────┘               │
│                                   ▼                                          │
│               [ AST Generative UI / Dynamic Layout Engine ]                  │
│               - Renders JSON UI states and streams to Edge                   │
+──────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Core Architecture Components

### A. The Sovereign Sensor Multiplexer (Edge Input)
Rather than writing sensor handlers per app, the mobile proxy runs a unified **Sensor Multiplexer**. This daemon packages all edge feeds into a standardized, timestamped spatial telemetry frame:
* **Visual Frame Bucket:** POV camera keyframes compressed via custom adaptive bitrate codecs to optimize wireless bandwidth.
* **Acoustic Stream Bucket:** continuous low-latency audio capture piped to a local audio buffer.
* **Kinetic Orientation Bucket:** IMU, compass, accelerometer, and gyroscopic data showing exact head pose vectors.
* **Gesture Payload:** Neural Band pinch/scroll/gestures and frame touchpad interactions.

This multiplexed package is pushed over a single, secure WebRTC / secure WebSocket tunnel directly to the NAS dispatch gateway.

### B. The Dynamic HUD Layout Engine (Edge Output)
The Web App running on the glasses contains **no application screens**. It is a generic, high-performance canvas engine that understands a declarative UI specification (extending our existing **AST Generative UI layouts** used in NEXUS/MatrixPanel).
* The server sends a JSON payload describing the layout in real-time (e.g., lines, boxes, text, spring-animated status cards, progress loops).
* The thin client parses this layout and renders it instantly on the in-lens display using the exact glassmorphism design system tokens defined in `docs/DESIGN.md`.
* **Outcome:** The same HUD runtime can display an interactive camera layout, a visual target indicator, a text teleprompter, or an email triage card depending entirely on the JSON payload pushed by the NAS.

### C. The Open-Ended Dispatch Gateway (NAS Controller)
When a spatial telemetry frame arrives at the NAS:
1. The **Acoustic Mesh** processes any voice activity.
2. The **Vision Mesh** processes visual targets if requested.
3. The **Intent Router** (`docs/INTENT_ROUTING_CONTRACT.md`) evaluates the collective input against all active skills and workflows in our canonical registry.
4. The router dispatches the execution to the appropriate local agent swarm, calculates the updated visual layout state, and streams the updated HUD JSON back to the glasses.

---

## 3. Why This Architecture Puts Us at the Forefront

1. **Infinite Adaptability:** If a new open-source model is released (e.g., a breakthrough 3D tracking or multi-modal LLM), we deploy it on our NAS. The glasses instantly gain this capability *without requiring a code change or app update on the mobile edge*.
2. **Zero Resource Constraints:** The glasses never run out of memory or battery trying to execute local machine learning models. The RTX 4090 NAS handles the heavy lifting, allowing the thin client to run cool and maximize battery life.
3. **Absolute Data Sovereignty:** Since the edge client acts as a dumb terminal, it does not store historical databases or cognitive logs locally. If the hardware is lost or compromised, zero private creative data is exposed.
4. **Future-Proofing Hardware:** When Meta releases newer glasses models with upgraded HUD resolutions or new sensors, we simply update the Sensor Multiplexer to package the new inputs. The core CLE platform remains untouched.

---

## 4. The General-Purpose Edge API

We define a highly flexible, open-ended JSON contract for the spatial runtime communication:

### A. Telemetry Frame (Glasses to NAS Gateway)
```json
{
  "timestamp": "2026-05-23T15:52:00.000Z",
  "client_id": "cle_lens_01",
  "sensors": {
    "pose": {
      "yaw": 142.5,
      "pitch": -12.4,
      "roll": 1.2
    },
    "gps": {
      "lat": 40.7128,
      "lon": -74.0060,
      "alt": 10.5
    },
    "gesture": {
      "type": "TOUCH_DOUBLE_TAP",
      "coordinate_x": 0.85
    }
  },
  "media": {
    "image_frame_base64": "/9j/4AAQSkZJRg...",
    "audio_chunk_wav": "UklGRiQAAABXQVZF..."
  }
}
```

### B. Declarative HUD Layout (NAS Gateway to Glasses)
```json
{
  "layout_id": "active_run_hud",
  "render_commands": [
    {
      "type": "CONTAINER",
      "style": "glassmorphism",
      "position": { "x": "80%", "y": "10%", "width": "18%", "height": "25%" },
      "children": [
        { "type": "TEXT", "content": "AGENT SWARM ACTIVE", "style": "brutalist_pink" },
        { "type": "PROGRESS_BAR", "value": 0.65, "color": "#00FFCC" }
      ]
    },
    {
      "type": "SPATIAL_MARKER",
      "target_pose": { "yaw": 145.0, "pitch": -10.0 },
      "label": "[SAM_MESH_PERFORMER_1]",
      "color": "#FF3366"
    }
  ]
}
```

---

> [!TIP]
> **Universal Stance:** This keeps the platform entirely open-minded. We are not building a SAM3D app, nor are we building a Memory Spine app. We are building the **Universal Spatial Operating Bridge** for the Creative Liberation Engine.
