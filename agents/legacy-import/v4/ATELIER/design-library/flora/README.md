# Flora.ai - Infinite Canvas Design Source

> AI-powered creative canvas for the Creative Liberation Engine design workflow

**Platform:** [Flora.ai](https://flora.ai) (formerly Flora Fauna)
**Project:** https://app.flora.ai/projects/ns7cg8c2gapnbfnb7gxv1y14ys801qa8
**Type:** Infinite canvas with multi-model AI generation
**Status:** Active integration
**Added:** February 21, 2026

---

## What is Flora.ai?

Flora.ai is an AI-powered infinite canvas platform that connects text, image, and video generation models into a single visual workspace. It enables creative professionals to build visual workflows by chaining different AI capabilities together as nodes on an infinite canvas.

### Why Flora.ai for Creative Liberation Engine?

Flora.ai aligns with the Creative Liberation Engine philosophy:
- **Node-based workflows** mirror the agent-based architecture
- **Multi-model approach** matches our model-agnostic design
- **Infinite canvas** supports the unlimited creative exploration we enable
- **Real-time collaboration** fits team-based agent workflows
- **Community templates** provide proven starting points

---

## Core Capabilities

### Node Types
| Node | Purpose | Models Available |
|------|---------|------------------|
| **Text** | Copy, descriptions, prompts | Claude, GPT-4, Gemini |
| **Image** | Visual generation & editing | Flux Pro, Stable Diffusion, Recraft |
| **Video** | Motion & animation | Veo, Kling, Higgsfield |

### Workflow Patterns for Creative Liberation Engine

1. **Brand Identity Generation**
   - Text prompt > Logo concepts > Style variations > Brand guide
   
2. **App Design Exploration**
   - Describe app > Generate UI concepts > Iterate variations > Export assets

3. **Motion Design Pipeline**
   - Storyboard text > Key frames > Animated sequences > Video output

4. **Design System Bootstrap**
   - Style direction > Component exploration > Token extraction > System doc

---

## Integration with ATELIER

### How Flora.ai Connects

```
ATELIER Conversational Layer
        |
        v
  Intent Parser (user describes what they want)
        |
        v
  Flora.ai Canvas (visual exploration & generation)
        |
        v
  Pattern Extraction (save proven patterns back to library)
        |
        v
  Design Library (indexed, searchable, reusable)
```

### Agent Roles

- **Aurora** reads Flora.ai workflows to understand design direction
- **BOLT** implements designs generated on the Flora canvas
- **Leonardo** guides aesthetic decisions within Flora workflows
- **CODEX** catalogs Flora-generated assets into the library

---

## Workflow Storage

Flora.ai workflows and exported assets should be stored here:

```
flora/
├── README.md              # This file
├── workflows/             # Saved Flora.ai workflow exports
│   ├── brand-identity/    # Brand generation workflows
│   ├── app-design/        # App UI exploration workflows
│   ├── motion-design/     # Animation & video workflows
│   └── design-system/     # System bootstrap workflows
├── exports/               # Generated assets from Flora
│   ├── images/            # Exported image assets
│   ├── videos/            # Exported video assets
│   └── style-guides/      # Generated style documentation
└── templates/             # Reusable Flora workflow templates
```

---

## Naming Clarification

> **Important:** "FLORA" in previous repo versions (V2 `FLORA-PATTERNS.md`) was a naming confusion. 
> - **Flora.ai** = The infinite canvas platform (this integration)
> - **Design tokens** = Live in `ATELIER/design-system/tokens/` (not called FLORA)
> 
> This has been corrected in V4.

---

*Every creative AI tool, thoughtfully connected.*
