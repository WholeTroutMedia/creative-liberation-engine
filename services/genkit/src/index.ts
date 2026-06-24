/**
 * Creative Liberation Engine v5 — Genkit Unified Provider Orchestration
 *
 * The single source of truth for all AI model interactions across
 * the Creative Liberation Engine ecosystem. Replaces hand-rolled provider
 * wrappers with production-ready Genkit plugins.
 *
 * Constitutional Compliance: Article II (Sovereignty), Article III (Human Supremacy)
 */

import 'dotenv/config';
import { memoryBus } from '@cle/memory';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { anthropic } from '@genkit-ai/anthropic';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { deepSeek } from '@genkit-ai/compat-oai/deepseek';
import { xAI } from '@genkit-ai/compat-oai/xai';
import { ollama } from 'genkitx-ollama';
import { vertexAI } from './plugins/vertex-ai.js';
import { resolveModel } from './config/model-registry.js';
import { traceStorage } from '@cle/observability';

// ---------------------------------------------------------------------------
// Provider Plugin Initialization
// ---------------------------------------------------------------------------

// Build plugin array dynamically based on available API keys
// NOTE: DeepSeek and xAI don't have official Genkit plugins yet.
// They can be added via @genkit-ai/compat-oai (OpenAI-compatible) when needed.
const plugins: any[] = [];

// Google AI (Gemini) — Primary provider
if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    plugins.push(
        googleAI({
            apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
            ...(process.env.GEMINI_BASE_URL ? { baseUrl: process.env.GEMINI_BASE_URL } : {}),
        })
    );
    console.log('[GENKIT] ✓ Google AI (Gemini) plugin loaded' + (process.env.GEMINI_BASE_URL ? ` via proxy: ${process.env.GEMINI_BASE_URL}` : ''));
}

// Anthropic (Claude)
if (process.env.ANTHROPIC_API_KEY) {
    plugins.push(anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
    console.log('[GENKIT] ✓ Anthropic (Claude) plugin loaded');
}

// OpenAI (GPT-4o)
if (process.env.OPENAI_API_KEY) {
    plugins.push(openAI({ apiKey: process.env.OPENAI_API_KEY }));
    console.log('[GENKIT] ✓ OpenAI (GPT-4o) plugin loaded');
}

// Vertex AI -- Gemini on Vertex + Claude on Vertex + Nano Banana 2
// Uses VERTEX_API_KEY (AQ. token) for all Vertex model calls
if (process.env.VERTEX_API_KEY || process.env.GOOGLE_API_KEY) {
    plugins.push(vertexAI({
        apiKey: process.env.VERTEX_API_KEY || process.env.GOOGLE_API_KEY,
        project: process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_PROJECT_ID || 'cle-engine',
        location: process.env.VERTEX_LOCATION || 'us-central1',
    }));
    console.log('[GENKIT] ✓ Vertex AI plugin loaded (Gemini on Vertex + Claude on Vertex)');
    console.log('[GENKIT]   Models: gemini-3.1-flash-image, claude-opus-4, claude-sonnet-4 + more');
}

// DeepSeek
if (process.env.DEEPSEEK_API_KEY) {
    plugins.push(deepSeek({ apiKey: process.env.DEEPSEEK_API_KEY }));
    console.log('[GENKIT] ✓ DeepSeek plugin loaded');
}

// xAI (Grok)
if (process.env.XAI_API_KEY) {
    plugins.push(xAI({ apiKey: process.env.XAI_API_KEY }));
    console.log('[GENKIT] ✓ xAI (Grok) plugin loaded');
}

// Ollama (Local models — offline sovereignty layer)
// All model strings are driven by MODEL_REGISTRY (model-registry.ts) via env vars.
// Tags verified via `ollama list` 2026-04-06. Pull new: `ollama pull <name>`
// Confirmed installed:
// - gemma4:e2b                      → Gemma 4 E2B (efficient 2B) — fast/edge ✅
// - gemma4:e4b                      → Gemma 4 E4B (efficient 4B) — medium edge ✅
// - gemma4:26b                      → Gemma 4 26B — primary reasoning ✅
// - qwen2.5-coder:32b               → Qwen 2.5 Coder 32B — code agent ✅
// - llava:latest / llava:34b        → LLaVA vision-language models ✅
// - llama3.3:70b-instruct-q4_K_M   → Llama 3.3 70B (RAM-offload) ✅
// - llama3.2:3b                     → Llama 3.2 3B — ultra-lightweight ✅
// - phi4-mini:latest                → Microsoft Phi 4 Mini ✅
// - nomic-embed-text                → 274MB, ChromaDB embeddings ✅
// ARCHITECTURE: Genkit runs on NAS (127.0.0.1), Ollama runs on Workstation (192.168.2.20)
const ollamaHost = process.env.OLLAMA_HOST ?? 'http://192.168.2.20:11434';

// Registry-driven — never hardcode model strings here.
// All values resolve from .env vars with sensible fallbacks in model-registry.ts.
export const LOCAL_MODEL_IDS = {
    code:   resolveModel('local:code'),   // qwen2.5-coder — primary coding agent
    fast:   resolveModel('local:fast'),   // gemma4:2b — fast general + edge
    mid:    resolveModel('local:mid'),    // gemma4:12b — mid-tier local reasoning
    large:  resolveModel('local:large'),  // gemma4:27b — heavy reasoning + vision
    embed:  resolveModel('local:embed'),  // nomic-embed-text — ChromaDB
    vision: resolveModel('local:vision'), // gemma4:27b — multimodal
} as const;

plugins.push(
    ollama({
        models: [
            // Gemma 4 27B — primary reasoning, vision-language, heavy tasks
            { name: LOCAL_MODEL_IDS.large, type: 'generate' },
            // Gemma 4 12B — mid reasoning
            { name: LOCAL_MODEL_IDS.mid, type: 'generate' },
            // Gemma 4 2B — fast general tasks, edge-deployable
            { name: LOCAL_MODEL_IDS.fast, type: 'generate' },
            // Qwen 2.5 Coder — primary local coding agent
            { name: LOCAL_MODEL_IDS.code, type: 'generate' },
            // Nomic Embed Text — ChromaDB vector memory
            { name: LOCAL_MODEL_IDS.embed, type: 'generate' as const },
        ],
        serverAddress: ollamaHost,
    })
);
console.log(`[GENKIT] ✓ Ollama plugin loaded → ${ollamaHost}`);
console.log(`[GENKIT]   Large: ${LOCAL_MODEL_IDS.large} | Mid: ${LOCAL_MODEL_IDS.mid} | Fast: ${LOCAL_MODEL_IDS.fast} | Code: ${LOCAL_MODEL_IDS.code} | Embed: ${LOCAL_MODEL_IDS.embed}`);


// Log warning if no cloud providers configured
if (plugins.length <= 1) {
    console.warn(
        '[GENKIT] ⚠ Only Ollama configured. Set GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY for cloud providers.'
    );
}

// ---------------------------------------------------------------------------
// Genkit Instance
// ---------------------------------------------------------------------------

// Deduplicate and filter any undefined/null plugins to prevent Genkit registry errors
// (Can happen if custom plugins return undefined name, or if both googleAI + vertexAI
//  are conditionally added via the same GOOGLE_API_KEY env var)
const seenPluginNames = new Set<string>();
const validPlugins = plugins.filter((p: any) => {
    if (!p) return false;
    const name = p?.name ?? p?.info?.name;
    console.log('[GENKIT] Plugin candidate:', {
        type: typeof p,
        name,
        keys: Object.keys(p)
    });
    if (!name) {
        return true;
    }
    if (seenPluginNames.has(name)) {
        console.warn(`[GENKIT] ⚠️  Filtered duplicate plugin: ${name}`);
        return false;
    }
    seenPluginNames.add(name);
    return true;
});
console.log('[GENKIT] Plugins array types:', validPlugins.map((p: any) => typeof p));
const rawAi = genkit({
    plugins: validPlugins,
});

export const ai = new Proxy(rawAi, {
    get(target, prop, receiver) {
        const val = Reflect.get(target, prop, receiver);
        if (typeof val === 'function') {
            return function(...args: any[]) {
                const options = args[0];
                if (options && typeof options === 'object') {
                    // Normalize 'model' parameter from googleAI/ to googleai/
                    if ('model' in options && typeof options.model === 'string' && options.model.startsWith('googleAI/')) {
                        try {
                            options.model = options.model.replace('googleAI/', 'googleai/');
                        } catch {
                            // If options is frozen/read-only, copy and override first argument
                            args[0] = {
                                ...options,
                                model: options.model.replace('googleAI/', 'googleai/')
                            };
                        }
                    }
                    // Normalize 'embedder' parameter from googleAI/ to googleai/
                    if ('embedder' in options && typeof options.embedder === 'string' && options.embedder.startsWith('googleAI/')) {
                        try {
                            options.embedder = options.embedder.replace('googleAI/', 'googleai/');
                        } catch {
                            args[0] = {
                                ...options,
                                embedder: options.embedder.replace('googleAI/', 'googleai/')
                            };
                        }
                    }
                }
                return val.apply(target, args);
            };
        }
        return val;
    }
});

// Wrap defineTool for automatic trace capture
const originalDefineTool = ai.defineTool.bind(ai);
(ai as any).defineTool = function (config: any, fn?: any) {
  const targetFn = fn || config?.fn;
  if (typeof targetFn === 'function') {
    const toolName = config.name;
    const wrappedFn = async (input: any, context?: any) => {
      const recorder = traceStorage.getStore() as any;
      if (recorder) {
        recorder.recordToolStart(toolName, input);
        try {
          const result = await targetFn(input, context);
          recorder.recordToolEnd(toolName, true, result);
          return result;
        } catch (err: any) {
          recorder.recordToolEnd(toolName, false, null, err.message);
          throw err;
        }
      }
      return targetFn(input, context);
    };

    return (originalDefineTool as any)(config, wrappedFn);
  }
  return (originalDefineTool as any)(config, fn);
};

console.log(`[GENKIT] 🚀 Creative Liberation Engine provider runtime initialized (${plugins.length} plugins)`);

// ── VERA: log boot event to cle-memory ──────────────────────────────
try {
    memoryBus.logBoot(
        'cle-engine-v5',
        '5.0.0',
        0, // Genkit initializes synchronously; boot time captured at import
        { plugins: plugins.length, ollamaHost },
    );
} catch (_e) {
    // Never block provider init
    console.warn('[GENKIT] MemoryBus boot log skipped:', _e);
}

// ---------------------------------------------------------------------------
// Re-exports for consumers
// ---------------------------------------------------------------------------

export { googleAI } from '@genkit-ai/google-genai';
export { anthropic } from '@genkit-ai/anthropic';
export { openAI } from '@genkit-ai/compat-oai/openai';
export { deepSeek } from '@genkit-ai/compat-oai/deepseek';
export { xAI } from '@genkit-ai/compat-oai/xai';
export { ollama } from 'genkitx-ollama';
export { z } from 'genkit';
export { generateWithFallback, FALLBACK_CHAINS } from './middleware/circuit-breaker.js';
export { generateWithCache } from './middleware/semantic-cache.js';
// Model registry — capability tiers, env-driven, no version strings in code
export { resolveModel, isLocalTier, logModelRegistry, MODEL_REGISTRY } from './config/model-registry.js';
export type { ModelTier, CloudTier, LocalTier } from './config/model-registry.js';
// Smart model router — classify → tier → model
export { smartRoute, logRouting } from './middleware/smart-router.js';
export type { RoutingDecision } from './middleware/smart-router.js';
// Local Ollama providers — sovereignty layer
export { localGenerate, localStream, checkOllamaHealth, LOCAL_MODELS } from './local-providers.js';
export type { LocalModelCapability } from './local-providers.js';

// Tools
// (Import directly from ./tools/scribe-memory.js to avoid circular dependencies)


// Note: Flow imports are handled in server.ts only to avoid ESM circular dependencies.
// Do NOT re-export flows from this index as they import `ai` from this module.
