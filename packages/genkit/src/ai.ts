import 'dotenv/config';
import './patch-fetch.js';

import { memoryBus } from '@cle/memory';
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { anthropic } from '@genkit-ai/anthropic';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { deepSeek } from '@genkit-ai/compat-oai/deepseek';
import { xAI } from '@genkit-ai/compat-oai/xai';
import { ollama } from 'genkitx-ollama';
import { vertexAI } from './plugins/vertex-ai.js';
import { resolveModel } from './config/model-registry.js';

// ---------------------------------------------------------------------------
// Provider Plugin Initialization
// ---------------------------------------------------------------------------

const plugins: any[] = [];

// Google AI (Gemini) — Primary provider
if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    plugins.push(
        googleAI({
            apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        })
    );
    console.log('[GENKIT] ✓ Google AI (Gemini) plugin loaded');
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
if (process.env.VERTEX_API_KEY || process.env.GOOGLE_API_KEY) {
    plugins.push(vertexAI({
        apiKey: process.env.VERTEX_API_KEY || process.env.GOOGLE_API_KEY,
        project: process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_PROJECT_ID || 'cle-engine',
        location: process.env.VERTEX_LOCATION || 'us-central1',
    }));
    console.log('[GENKIT] ✓ Vertex AI plugin loaded (Gemini on Vertex + Claude on Vertex)');
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
const ollamaHost = process.env.OLLAMA_HOST ?? 'http://192.168.2.20:11434';

// Registry-driven — never hardcode model strings here.
export const LOCAL_MODEL_IDS = {
    code:       resolveModel('local:code'),             // qwen2.5-coder:32b — primary coding agent
    fast:       resolveModel('local:fast'),             // gemma4:e2b — fast general + edge
    large:      resolveModel('local:large'),            // gemma4:26b — heavy reasoning + vision
    embed:      resolveModel('local:embed'),            // nomic-embed-text — ChromaDB
    vision:     resolveModel('local:vision'),           // llava:34b — multimodal vision
    multimodal: resolveModel('local:multimodal'),       // nemotron3 — WS-6
    reasoning:  resolveModel('local:reasoning'),        // deepseek-r1:32b — WS-6
    reasonFast: resolveModel('local:reasoning:fast'),   // deepseek-r1:8b — WS-6
} as const;

plugins.push(
    ollama({
        models: [
            { name: LOCAL_MODEL_IDS.large, type: 'generate' },
            { name: LOCAL_MODEL_IDS.fast, type: 'generate' },
            { name: LOCAL_MODEL_IDS.code, type: 'generate' },
            { name: LOCAL_MODEL_IDS.embed, type: 'generate' as const },
            { name: LOCAL_MODEL_IDS.multimodal, type: 'generate' },
            { name: LOCAL_MODEL_IDS.reasoning, type: 'generate' },
            { name: LOCAL_MODEL_IDS.reasonFast, type: 'generate' },
            { name: 'qwen2.5:3b', type: 'generate' },
            { name: 'qwen3.5:0.8b', type: 'generate' },
        ],
        serverAddress: ollamaHost,
    })
);
console.log(`[GENKIT] ✓ Ollama plugin loaded → ${ollamaHost}`);
console.log(`[GENKIT]   Large: ${LOCAL_MODEL_IDS.large} | Fast: ${LOCAL_MODEL_IDS.fast} | Code: ${LOCAL_MODEL_IDS.code} | Embed: ${LOCAL_MODEL_IDS.embed}`);

// Log warning if no cloud providers configured
if (plugins.length <= 1) {
    console.warn(
        '[GENKIT] ⚠ Only Ollama configured. Set GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY for cloud providers.'
    );
}

// Deduplicate and filter plugins safely (preserving functions and anonymous plugins like ollama and vertexAI)
const seenPluginNames = new Set<string>();
const validPlugins = plugins.filter((p: unknown) => {
    if (!p) return false;
    if (typeof p === 'function') return true;
    const name = (p as any)?.name ?? (p as any)?.info?.name;
    if (!name) return true;
    if (seenPluginNames.has(name)) {
        console.warn(`[GENKIT] ⚠️  Filtered duplicate plugin: ${name}`);
        return false;
    }
    seenPluginNames.add(name);
    return true;
});
console.log('[GENKIT] Plugins array types:', validPlugins.map((p: unknown) => typeof p));

const rawAi = genkit({
    plugins: validPlugins,
});

export const ai = new Proxy(rawAi, {
    get(target, prop, receiver) {
        const val = Reflect.get(target, prop, receiver);
        if (typeof val === 'function') {
            if (prop === 'generate') {
                return async function(options: any, ...rest: any[]) {
                    if (options && typeof options === 'object') {
                        // Normalize 'model' parameter from googleAI/ to googleai/
                        if ('model' in options && typeof options.model === 'string' && options.model.startsWith('googleAI/')) {
                            try {
                                options.model = options.model.replace('googleAI/', 'googleai/');
                            } catch {
                                options = {
                                    ...options,
                                    model: options.model.replace('googleAI/', 'googleai/')
                                };
                            }
                        }
                    }

                    const originalModel = options?.model;
                    const isCloudModel = typeof originalModel === 'string' && 
                        (originalModel.includes('googleai/') || originalModel.includes('anthropic/') || originalModel.includes('openai/'));

                    if (isCloudModel) {
                        try {
                            return await val.call(target, options, ...rest);
                        } catch (err: any) {
                            console.error(`[GENKIT-PROXY] Cloud model call to "${originalModel}" failed: ${err.message}. Cascading to local edge fallback...`);
                            
                            // Fall back to qwen2.5:3b (verified pulled on NAS)
                            const fallbackModel = 'ollama/qwen2.5:3b';
                            console.log(`[GENKIT-PROXY] 🦙 Invoking local fallback model: "${fallbackModel}"`);
                            
                            const fallbackOptions = {
                                ...options,
                                model: fallbackModel
                            };
                            try {
                                return await val.call(target, fallbackOptions, ...rest);
                            } catch (fallbackErr: any) {
                                console.error(`[GENKIT-PROXY] Local fallback model "${fallbackModel}" also failed: ${fallbackErr.message}`);
                                throw err;
                            }
                        }
                    }

                    return val.call(target, options, ...rest);
                };
            }

            return function(...args: unknown[]) {
                const options = args[0] as Record<string, any> | undefined;
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
                return val.apply(target, args as any);
            };
        }
        return val;
    }
});

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
    console.warn('[GENKIT] MemoryBus boot log skipped:', _e);
}

export { z };
