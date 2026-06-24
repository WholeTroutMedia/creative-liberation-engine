# 🌸 FLORA Patterns - Design Language Reference

**Created:** January 27, 2026
**Source:** Flora Fauna AI (florafauna.ai)
**Purpose:** Design patterns and terminology for NEXUS Canvas integration
**Decision:** Option C Hybrid - Use Flora for creative generation, build NEXUS canvas for agent orchestration

---

## Core Concepts

### The Infinite Canvas
Flora's primary workspace metaphor - an unlimited 2D space where blocks can be placed, connected, and organized freely.

**Key Principles:**
- Dark void background = infinite possibility
- Glowing blocks = focused attention points
- Curved connections = organic data flow
- No boundaries = unlimited creative space

### Blocks
The fundamental unit of content in Flora. Each block is a self-contained element that can generate, display, or transform content.

**Block Types:**
| Type | Shortcut | Purpose | Models |
|------|----------|---------|--------|
| Text | T | Text generation/display | GPT-5.2, Claude |
| Image | I | Image generation | Flux 2, Imagen 4, Photon |
| Video | V | Video generation | Kling, Seedance, Luma |
| Upload | U | Import external assets | N/A |

### Flows (Groups)
Multi-node workflows that chain blocks together. Saved as reusable templates.

**Example Flows:**
- Style Extractor (4 nodes)
- Color Palette Extractor (5 nodes)
- Image to Video Camera Movements (10 nodes)
- Sketch to Render (16 nodes)
- Image Model Comparisons (17 nodes)

### Connections
Visual lines that show data flow between blocks. Curved bezier paths create organic feel.

---

## UI Components

### Left Toolbar
```
+ Add Block (Text/Image/Video/Upload)
◆ Assets Panel (My Files, Saved Blocks, Unsplash)
⏰ History (searchable)
🔗 Groups/Flows (Featured, My Groups)
⚙️ Settings
💬 Comments
❓ Help
👤 Profile
```

### Block Header
```
[Icon] BLOCK NAME          [Model] ▼
```

### Properties Panel (Right)
```
BLOCK NAME
─────────────────
Format:     PNG
Size:       153.5 KB
Resolution: 1024 × 1360
Created:    1/27/2026
Creator:    [User]
─────────────────
⚙️ Generate
─────────────────
Model:        [Dropdown]
Quality:      [Slider 1-100]
Aspect Ratio: [Dropdown]
Acceleration: [Regular/Turbo]
Seed:         [Number]
```

### Quick Start Panel
Shown on empty canvas:
```
"Double-click anywhere to create a new Block, or start with..."

[Describe an Image] [Combine ideas] [Make a video] [Explore Flows] [...]
```

---

## Model Providers

### Image Generation
| Provider | Models | Best For |
|----------|--------|----------|
| Black Forest Labs | Flux 2, Flux Max, Flux Dev, Flux Depth | High-quality, fast |
| Google | Imagen 4, Nano Banana Pro, Gemini Flash | Photorealistic, text |
| Ideogram | Various | Stylized |
| Alibaba | Various | Alternative styles |

### Video Generation
| Provider | Models | Best For |
|----------|--------|----------|
| Kling | 2.6 Pro, 2.5 Turbo, OI series | Motion, consistency |
| Bytedance | Seedance 1.5 | General video |
| Luma | Dream Machine | Cinematic |
| Lightricks | LTX | Quick iterations |

### Text Generation
| Provider | Models | Best For |
|----------|--------|----------|
| OpenAI | GPT-5.2 | General, analysis |
| Anthropic | Claude | Reasoning, safety |

---

## Terminology Mapping

### Flora → NEXUS Translation
| Flora Term | NEXUS Equivalent | Notes |
|------------|------------------|-------|
| Block | Agent Card | Visual representation |
| Flow | Agent Flow | Multi-agent workflow |
| Connection | Handoff | Data/context passing |
| Canvas | Orchestration View | Visual workspace |
| Group | Flow Template | Saved workflow |
| Provider | Model Provider | AI service source |
| Queue | Execution Queue | Active jobs |
| Credits | Compute Units | Usage tracking |

---

## Design Tokens

### Colors (Dark Theme)
```css
--canvas-bg: #0a0a0a;
--block-bg: #1a1a1a;
--block-border: #2a2a2a;
--block-selected: #00d4aa;
--connection-line: #444444;
--text-primary: #ffffff;
--text-secondary: #888888;
--accent-cyan: #00d4aa;
--accent-gold: #ffd700;
--accent-violet: #9b59b6;
```

### Spacing
```css
--block-padding: 16px;
--block-gap: 24px;
--toolbar-width: 48px;
--panel-width: 280px;
```

### Typography
```css
--font-family: 'Inter', system-ui, sans-serif;
--font-size-sm: 12px;
--font-size-md: 14px;
--font-size-lg: 16px;
--font-weight-normal: 400;
--font-weight-medium: 500;
```

---

## Implementation Notes

### For NEXUS Canvas View
1. **Adopt dark canvas aesthetic** - matches Flora's infinite void
2. **Use blocks for agents** - each agent = one block
3. **Show connections** - visualize VERA handoffs
4. **Enable drag-and-drop** - reposition agents freely
5. **Add quick-create** - double-click to spawn agent

### Integration Points
- Flora API for creative generation (images, video)
- NEXUS handles agent orchestration logic
- Shared design language for consistency
- Unified credit/compute tracking

---

**Documented by:** COMET + AURORA
**Approved by:** ATHENA (Strategic)
**Logged by:** VERA (Scribe)
**Date:** January 27, 2026
