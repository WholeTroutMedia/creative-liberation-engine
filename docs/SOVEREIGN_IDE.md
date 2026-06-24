> WARNING DEPRECATED - Consolidated into NEXUS. See docs/NEXUS.md

# Sovereign IDE Integration — Continue.dev

> **Version:** 1.0.0  
> **Date:** 2026-04-22  
> **Context:** Integration of zero-latency, sovereign autocomplete and codebase reasoning via Continue.dev, mapping directly to the V6 model registry.

---

## Architectural Thesis

The Creative Liberation Engine V6 already provides multi-agent orchestration (via dispatch) and local model routing (via Genkit and Ollama). The missing component in the developer experience is **zero-latency inline autocomplete** and **in-editor codebase RAG**.

Instead of migrating to a new editor fork (Void) or introducing a competing autonomous agent (Cline), **Continue.dev** is deployed as an overlay extension. It fills the specific UX gaps without conflicting with the engine's core orchestration layer.

### Why Continue.dev?
1. **Zero-Latency Autocomplete:** Leverages the `local:code:fast` tier (`qwen2.5-coder:7b`) sitting permanently in VRAM for instantaneous `Tab`-to-accept code generation.
2. **Sovereign Codebase RAG:** Indexes the entire `creative-liberation-engine` repository locally using the `local:embed` tier (`nomic-embed-text`), ensuring proprietary code never leaves the local network.
3. **Registry Alignment:** Its configuration maps 1:1 with `models.canonical.json`.
4. **Telemetry Source:** Model usage data from Continue can eventually feed into the Pulse monitoring service for the V6 HUD.

---

## Model Registry Mapping

The Continue.dev configuration routes to the NAS Ollama instance (`127.0.0.1:11434`).

| Continue Role | V6 Registry Tier | Model | Hardware Allocation |
|---------------|------------------|-------|---------------------|
| `tabAutocompleteModel` | `local:code:fast` | `qwen2.5-coder:7b` | Always-hot (GPU 1) |
| `models` (Chat) | `local:large` | `gemma4:26b` | Swappable / GPU 2 (M1) |
| `models` (Refactor) | `local:code` | `qwen2.5-coder:32b` | Swappable / GPU 2 (M1) |
| `embeddingsProvider` | `local:embed` | `nomic-embed-text` | Always-hot (Minimal VRAM) |

---

## Configuration (`config.json`)

To apply this configuration, install the **Continue** extension in VS Code, then replace the contents of `~/.continue/config.json` (or `%USERPROFILE%\.continue\config.json` on Windows) with the following:

```json
{
  "models": [
    {
      "title": "Gemma 4 (26b) - Reasoning",
      "provider": "ollama",
      "model": "gemma4:26b",
      "apiBase": "http://127.0.0.1:11434"
    },
    {
      "title": "Qwen 2.5 Coder (32b) - Complex Refactor",
      "provider": "ollama",
      "model": "qwen2.5-coder:32b",
      "apiBase": "http://127.0.0.1:11434"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Qwen 2.5 Coder (7b) - Autocomplete",
    "provider": "ollama",
    "model": "qwen2.5-coder:7b",
    "apiBase": "http://127.0.0.1:11434",
    "useCache": true
  },
  "embeddingsProvider": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "apiBase": "http://127.0.0.1:11434"
  },
  "slashCommands": [
    {
      "name": "edit",
      "description": "Edit selected code"
    },
    {
      "name": "comment",
      "description": "Write comments for the selected code"
    },
    {
      "name": "share",
      "description": "Export the current chat session to markdown"
    }
  ],
  "customCommands": [
    {
      "name": "dispatch",
      "prompt": "You are formulating a task for the Creative Liberation Engine dispatch system. Summarize the user's request into a precise JSON task object that can be sent to the dispatch API.",
      "description": "Format request for V6 Dispatch"
    }
  ],
  "contextProviders": [
    {
      "name": "codebase",
      "params": {}
    },
    {
      "name": "folder",
      "params": {}
    },
    {
      "name": "terminal",
      "params": {}
    }
  ],
  "allowAnonymousTelemetry": false
}
```

---

## Validation & Workflow

### 1. Autocomplete Test
- Open any TypeScript or Markdown file.
- Begin typing a function signature (e.g., `export async function routeToAgent(`).
- `qwen2.5-coder:7b` should instantly suggest the completion.
- Press `Tab` to accept.

### 2. Codebase RAG Test
- Open the Continue sidebar (Chat).
- Type `@codebase How does the V6 routing contract map route IDs to upstream services?`
- Continue will use `nomic-embed-text` to retrieve relevant chunks from `ROUTING_CONTRACT.md` and pass them to `gemma4:26b` for a synthesized answer.

### 3. GPU Growth Plan Alignment
Currently, loading `qwen2.5-coder:7b` for autocomplete and `gemma4:26b` for chat simultaneously will consume ~21GB of your 24GB RTX 4090 VRAM. 

When **Milestone 1** (Second GPU) from `GPU_GROWTH_PLAN.md` is reached:
- **GPU 1** will permanently host `qwen2.5-coder:7b` (autocomplete) + system routing models.
- **GPU 2** will host the heavy `32b` and `26b` models for in-editor chat and complex refactoring.
- This will eliminate all model-swapping latency and provide a true zero-wait sovereign IDE experience.
