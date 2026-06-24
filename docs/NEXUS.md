# NEXUS — Sovereign Unified Surface

> **Status:** IN_PROGRESS  
> **ID:** IE-HRT-052  
> **Version:** 3.0  
> **Supersedes:** KROMA_SPACE_BLUEPRINT.md, SOVEREIGN_IDE.md, Kade IDE (IE-HRT-038)  
> **Last Updated:** 2026-05-15

---

## Definition

NEXUS is the **master sovereign surface** for the Creative Liberation Engine. It is not a single application — it is the **unified shell** that contains every operator interface, tool, and creative environment inside one cohesive experience.

> Core question: *" Does this make artists more free or less free?\* 
> NEXUS is the answer made tangible.

---

## What NEXUS Is NOT

- ❌ A single React app 
- ❌ A standalone code editor 
- ❌ Only the 3D cityscape canvas 
- ❌ Only an ops dashboard 
- ❌ A rename of \Nexus Command\ (the V4 ops hub — that is a component, not the container)

---

## What NEXUS IS

The **unified shell** where every mode of interacting with the Creative Liberation Engine lives:

| Mode | Component | Location | Status |
|------|-----------|----------|--------|
| **Spatial Canvas** | 
exus-canvas | pps/nexus-canvas | Built (3D city telemetry) |
| **Venue Twin** | spatial-os | surfaces/spatial-os | Built (Gaussian Splat + GLTF viewer) |
| **IDE Panels** | Code editor, agent chat, task board | TBD — panels atop 3D shell | Unbuilt |
| **Ops Hub** | Dispatch board, agent roster, system health | pps/engine-room | Partial |
| **HUD Overlay** | Live telemetry, AVERI alerts | pps/cle-hud | Built |
| **Creative Engine** | Audio-reactive visual / KROMA physics | Unbuilt | IDEATED |
| **Agent Control** | Agent spawn, skill assignment, blocker triage | Unbuilt | IDEATED |

---

## Architecture Principle

NEXUS operates as a **spatial shell with floating panel layers**:

`
┌─────────────────────────────────────────────────────┐
│ NEXUS SHELL │
│ ┌────────────────────────────────────────────────┐ │
│ │ 3D Spatial Canvas (Three.js / R3F) │ │
│ │ nexus-canvas cityscape OR spatial-os venue │ │
│ └────────────────────────────────────────────────┘ │
│ │
│ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│ │ IDE Panel│ │ Ops Panel│ │ HUD Overlay Layer │ │
│ │ (code, │ │(dispatch,│ │ (AVERI status, │ │
│ │ agents) │ │ health) │ │ telemetry, alerts)│ │
│ └──────────┘ └──────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────┘
 ↕ Creative Liberation Engine API / MCP
`

The 3D canvas is always the backdrop. Panels are floating overlays that dock, collapse, and switch context. The Engine feeds live data into all layers simultaneously.

---

## Components

### 
exus-canvas (pps/nexus-canvas)
3D instanced cityscape. 2,000 animated nodes driven by Engine telemetry. Node height = activity signal. Colors: cyan = anomaly, pink = alert, dark = idle. Cyberpunk palette.

### spatial-os (surfaces/spatial-os)
Venue twin renderer. Loads GLTF meshes and Gaussian Splat assets. Used for live venue digital twins (Hill Country Zero Day, etc.). Integrates with enue-twin service.

### engine-room (pps/engine-room)
Ops panel. Dispatch queue, agent roster, service health. Currently a separate app — NEXUS is the eventual container.

### cle-hud (pps/cle-hud)
HUD overlay layer. AVERI status, live telemetry, alert ribbons. Already overlaid in spatial-os.

### Creative Engine (Unbuilt)
Audio-reactive visual physics. Fluid simulations, SDF rendering, WebGPU compute shaders. Artists input images + musical intent → living spatial artwork. Legal audio generation via open-license classical corpus.

---

## Consolidated Heritage IDs

| Deprecated ID | Former Title | Fate |
|---------------|-------------|------|
| IE-HRT-038 | Kade IDE — Browser-Based AI Dev Env | Deprecated → NEXUS IDE panels |
| IE-HRT-052 | KROMA Space — Sovereign Creative IDE | **This entry, now NEXUS** |
| IE-HRT-053 | Sovereign IDE — Custom Dev Environment | Deprecated → NEXUS IDE panels |

---

## Relationship to \Nexus Command\ (IE-HRT-009)

**Nexus Command** was the V4 internal ops hub — considered SHIPPED/COMPLETED in V4. 
In V6, \Nexus Command\ = the **Ops Panel mode** of NEXUS. It is a component, not a container.

NEXUS (this doc) is the container.

---

## Next Build Steps

- [ ] Unify 
exus-canvas and spatial-os into a single shell with switchable canvas modes
- [ ] Mount engine-room panels as floating overlays on the 3D shell
- [ ] Wire Creative Liberation Engine dispatch API to node activity in 
exus-canvas
- [ ] Design IDE panel UX (code editor, agent chat, task board as dockable panels)
- [ ] Prototype Creative Engine: audio-reactive particle system on top of WebGPU
- [ ] Formal V6 schemas/nexus.surface.schema.json definition

---

## Guiding Principle

> Every tool an artist or operator needs — code, agents, ops, spatial creation — accessible without ever leaving the Engine's visual world.
