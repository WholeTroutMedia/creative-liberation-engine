# Figma Weave Multi-Modal Video Conductor

> **Status:** SHIPPED (V6 Helix Extension)  
> **ID:** IE-HRT-082  
> **Version:** 1.0.0  
> **Location:** [VideoConductorPanel.jsx](file:///y:/creative-liberation-engine/apps/nexus/src/panels/VideoConductorPanel.jsx)  
> **AST Layout Schema:** [video-conductor.ast.json](file:///y:/creative-liberation-engine/runtime/layouts/video-conductor.ast.json)  
> **Last Updated:** 2026-05-27

---

## 1. Overview & Vision

The **Weave Video Conductor** is the sovereign multi-modal workflow console integrated directly into the **NEXUS master shell** (V6 sovereign unified surface). It translates dynamic generative layout specifications compiled via **Figma Weave** (`.ast.json` schemas) into interactive visual control structures. 

This environment automates the unified workflow:
1. **Sovereign NAS Footage Indexing & Querying** using the **Twelve Labs API proxy** (via `video-agency`).
2. **Keyframe-guided Animation & Syntheses** using **Google Flow browser orchestration** (managed locally by a headless Playwright Chrome-Agent).
3. **Local Conformed Timeline Assembly** (compiling conformed edit decision lists).
4. **DaVinci Resolve conforming integration** (pushing the timeline conformed JSON directly to the local DaVinci Resolve instance on the editor's station via Python-based local socket proxies).

```
                      [FIGMA WEAVE CANVAS]
                               │
                               ▼ (Generative UI AST compiler)
                      [NEXUS FLOATING HUD]
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼ (12Labs Proxy)        ▼ (Chrome-Agent)        ▼ (Local Resolve API)
[Synology NAS Ingest]   [Google Flow Browser]   [DaVinci Resolve Conforms]
```

---

## 2. Dynamic Figma Weave AST Architecture

Under the CLE Weave paradigm, the visual panels of the Video Conductor are defined via a declarative Abstract Syntax Tree (AST) in [video-conductor.ast.json](file:///y:/creative-liberation-engine/runtime/layouts/video-conductor.ast.json). Rather than hard-coding rigid layouts, the NEXUS UI compiler dynamically compiles the layout.

The AST schema outlines 4 primary visual panels:
- **01 // Semantic Search / Twelve Labs Proxy:** Natural language prompt input targeting the local-first Synology NAS `media_intake` indexes.
- **02 // Orchestrator Prompt Builder:** Synthesis parameters, style canons, and duration triggers for Google Flow.
- **03 // Chrome-Agent Telemetry Console:** Heads-up logs detailing the real-time execution steps of the Playwright agent navigating Google Flow.
- **04 // Sovereign Edit Decision Timeline:** A track-based layout (Track V1: Raw Footage, Track V2: Flow transition fx) displaying conformed timing with compilation buttons.

---

## 3. High-Fidelity Multi-Modal Implementation

### A. Semantic Search (`video-agency` REST Proxy)
The search panel queries the Twelve Labs proxy REST server listening at port `5103`:
* **API Route:** `POST /api/v1/video/search`
* **JSON Body:** `{ "indexId": "mock-index-id", "query": "..." }`
* **Fallback Protocol:** In sandbox or disconnected scenarios, a local-first metadata engine matches keyword queries against the local Synology NAS indexing spine (Level 2 Conduit, Drywall framing, walkthrough benchmarks) to guarantee high-fidelity operation without internet access.

### B. Playwright Chrome-Agent Google Flow Orchestrator
To bypass manual user intervention, a local service leverages the existing `cortex-chat-bridge` context:
1. Spawns a headless browser session.
2. Navigates to Google Flow.
3. Authenticates using existing secure cookie storage.
4. Uploads high-fidelity keyframe JPEGs extracted from the raw NAS footage.
5. Injects the styling prompt and triggers the compilation sequence.
6. Downloads the generated 24fps high-fidelity transition asset directly back to Synology NAS.

### C. DaVinci Resolve Local Socket Conformer
Once raw footage and Flow transition markers are conformed in the timeline preview track, clicking **COMPILE & PUSH DIRECTLY TO DAVINCI RESOLVE** fires a conforming request:
* **API Route:** `POST /slate-sync` targeting port `5103` (which proxies to the Python-based local Resolve socket at port `5105`).
* **Python Conductor:** `davinci-resolve-bridge.py` parses the JSON track descriptors, imports the local Synology paths, and compiles/injects the timed edit sequence instantly onto the editor's live DaVinci timeline track.

---

## 4. System Verification

- **Dynamic Layout:** Verified loadability of `video-conductor.ast.json` in the NEXUS layout engine matrix.
- **Component Mount:** Successfully registered and mounted `VideoConductorPanel.jsx` in the floating panel registry of `App.jsx` under the `🎥 CONDUCTOR` navbar.
- **Brutalist Style:** Conforms exactly to `DESIGN.md` guidelines (`#000000` pitch canvas, subtle glass styling, `--cyan` and `#a78bfa` highlighting, and fully animated micro-interactions).
