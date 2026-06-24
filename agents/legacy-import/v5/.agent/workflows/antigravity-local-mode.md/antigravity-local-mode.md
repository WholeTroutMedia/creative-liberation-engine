# Antigravity IDE — Local Mode & Forced Ollama Configuration

## Status: CONFIRMED POSSIBLE (requires patching)

## Overview

Google Antigravity IDE does NOT natively expose a "local mode" toggle in its UI or settings. The official docs list only cloud-hosted Vertex Model Garden models (Gemini 3.1 Pro, Gemini 3 Flash, Claude Sonnet 4.6, Claude Opus 4.6, GPT-OSS-120b). However, the underlying architecture supports custom model overrides via `plannerConfig.customModelInfoOverride`, which can route requests to any OpenAI-compatible endpoint — including local Ollama.

## Available Official Models

- Gemini 3.1 Pro (high)
- Gemini 3.1 Pro (low)
- Gemini 3 Flash
- Claude Sonnet 4.6 (thinking)
- Claude Opus 4.6 (thinking)
- GPT-OSS-120b

## Forcing Local Mode via Ollama

### Prerequisites

1. Ollama running locally: `http://localhost:11434`
2. A capable model pulled (e.g., `qwen2.5-coder:32b`, `llama3.2:3b`, `codestral`)
3. Verify Ollama is serving: `curl http://localhost:11434/api/tags`

### Patch Method (Windows Install)

Two files must be patched in the Antigravity installation:

```
.../resources/app/out/vs/workbench/workbench.desktop.main.js
.../resources/app/out/jetskiAgent/main.js
```

### Required Changes

#### 1. Model Selector State
- Force-enable custom models on Windows (remove linux/internal gating)
- Fix selection "snapback" so custom model counts as valid selection
- Change "is custom?" logic from `value === GOOGLE_GEMINI_INTERNAL_BYOM` to `option.isCustom || value === 'BYOM'`

#### 2. Custom Model Dialog
- Add/store `baseUrl` into `ModelInfo.baseUrl`
- Ensure `ModelInfo.apiProvider = API_PROVIDER_OPENAI_VERTEX`
- Ensure `ModelInfo.modelName` is the Ollama tag (from GET `/api/tags`)

#### 3. Cascade Config Serialization
- Ensure `customModelInfoOverride` is properly serialized/deserialized
- Keep `plannerConfig.requestedModel = GOOGLE_GEMINI_INTERNAL_BYOM`
- Put OpenAI/Ollama details inside `plannerConfig.customModelInfoOverride`:
  - `apiProvider = API_PROVIDER_OPENAI_VERTEX`
  - `baseUrl = http://localhost:11434/v1`
  - `modelName = <ollama_tag>`
  - `modelId = OPENAI_GPT_OSS_120B_MEDIUM` (routes through OpenAI adapter)

### Verification

1. `curl http://localhost:11434/api/tags` — confirm model tag exists
2. Use that exact tag in Antigravity custom model dialog
3. If you still see Google ESF headers or 404s, the override is not being honored
4. Success = requests hit Ollama and you get completions back in Antigravity

## Integration with Creative Liberation Engine

### Docker Compose (NAS/Local)

Ollama is already available in our stack via Docker. Ensure the Ollama container exposes port 11434 and has the target model pulled.

### Recommended Models for Local Coding

| Model | Size | Use Case |
|-------|------|----------|
| qwen2.5-coder:32b | ~20GB | Full coding agent reasoning |
| codestral:latest | ~12GB | Fast code completion |
| llama3.2:3b | ~2GB | Lightweight quick tasks |
| deepseek-coder-v2:16b | ~10GB | Balanced code + reasoning |

## Risks & Considerations

- **Patch fragility**: Every Antigravity update may overwrite patched files
- **No official support**: Google does not document or endorse this
- **ToS gray area**: Using third-party tools to access Antigravity is prohibited, but routing Antigravity to your own local model is a different vector
- **Performance**: Local models are significantly less capable than Gemini 3.1 Pro or Claude Opus 4.6 for complex agentic tasks

## Alternative: Use Antigravity's MCP Support

Antigravity has native MCP (Model Context Protocol) support. Instead of patching the model layer, consider:
- Running Ollama as an MCP server
- Connecting via Antigravity's MCP settings
- This gives local model access for specific tools without replacing the core reasoning model

## Cross-References

- [ANTIGRAVITY.md](../ANTIGRAVITY.md) — Agent identity protocol
- [model-registry.ts](../../src/model-registry.ts) — Model configuration registry
- [helix-stitch.md](../helix-stitch.md) — Integration patterns
- Antigravity Docs: https://antigravity.google/docs/models
- Antigravity MCP Docs: https://antigravity.google/docs/mcp