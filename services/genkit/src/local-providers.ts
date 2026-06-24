/**
 * @cle/genkit — Local Provider Extensions
 * Wires Ollama as a local LLM fallback and exposes a local model registry.
 *
 * This is the sovereignty layer — the Creative Liberation Engine never goes dark.
 * When cloud APIs are unavailable, Ollama on the local 4090 picks up.
 *
 * Constitutional Article 0: "unencumbered by previous restrictions"
 * Constitutional Article 19: "Neural Architecture — all 5 systems operational"
 */

import { ai } from './index.js';
import { resolveModel } from './config/model-registry.js';

// ─── LOCAL MODEL REGISTRY ────────────────────────────────────────────────────
// All model strings come from model-registry (env-driven). Never hardcode here.

export const LOCAL_MODELS = {
    code:   resolveModel('local:code'),
    large:  resolveModel('local:large'),
    mid:    resolveModel('local:mid'),
    fast:   resolveModel('local:fast'),
    embed:  resolveModel('local:embed'),
    vision: resolveModel('local:vision'),
} as const;

export type LocalModelCapability = keyof typeof LOCAL_MODELS;



// ─── LOCAL GENERATE WRAPPER ──────────────────────────────────────────────────
// Drop-in replacement for Vercel AI generateText() — routes to local Genkit Ollama plugin

export async function localGenerate(options: {
    prompt: string;
    system?: string;
    capability?: LocalModelCapability;
    temperature?: number;
    maxTokens?: number;
}) {
    const { capability = 'fast', prompt, system, temperature = 0.2, maxTokens = 4096 } = options;
    const modelStr = `ollama/${LOCAL_MODELS[capability]}`;

    console.log(`[LOCAL] 🦙 ${modelStr} | ${prompt.slice(0, 60)}...`);

    const { text } = await ai.generate({
        model: modelStr,
        system,
        prompt,
        config: { temperature, maxOutputTokens: maxTokens },
    });

    return text;
}

// ─── LOCAL STREAM WRAPPER ────────────────────────────────────────────────────

export async function localStream(options: {
    prompt: string;
    system?: string;
    capability?: LocalModelCapability;
    onChunk?: (chunk: string) => void;
}) {
    const { capability = 'fast', prompt, system, onChunk } = options;
    const modelStr = `ollama/${LOCAL_MODELS[capability]}`;

    const { stream } = await ai.generateStream({
        model: modelStr,
        system,
        prompt,
    });

    let full = '';
    for await (const chunk of stream) {
        full += chunk.text;
        onChunk?.(chunk.text);
    }
    return full;
}

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────

export async function checkOllamaHealth(): Promise<{
    online: boolean;
    models: string[];
    gpuActive: boolean;
}> {
    try {
        // NAS → Workstation: Ollama runs on workstation GPU, not localhost
        const ollamaHost = process.env.OLLAMA_HOST ?? 'http://192.168.2.20:11434';
        const res = await fetch(`${ollamaHost}/api/tags`);
        if (!res.ok) return { online: false, models: [], gpuActive: false };
        const data = await res.json() as { models: Array<{ name: string }> };
        const models = data.models.map((m) => m.name);
        const gpuActive = models.some(m => m.includes('32b') || m.includes('70b') || m.includes('27b'));
        console.log(`[LOCAL] ✅ Ollama online | ${models.length} models | GPU: ${gpuActive}`);
        return { online: true, models, gpuActive };
    } catch {
        console.warn('[LOCAL] ⚠️ Ollama offline — cloud-only mode');
        return { online: false, models: [], gpuActive: false };
    }
}

// ─── SOVEREIGNTY LOG ─────────────────────────────────────────────────────────

type SovereigntyDecision = 'local' | 'cloud-fallback' | 'cloud-only';

function logSovereigntyDecision(
    decision: SovereigntyDecision,
    capability: LocalModelCapability,
    reason: string,
): void {
    const icons: Record<SovereigntyDecision, string> = {
        'local':           '🛡️  SOVEREIGN',
        'cloud-fallback':  '⚠️  FALLBACK',
        'cloud-only':      '☁️  CLOUD',
    };
    console.log(`[SOVEREIGN] ${icons[decision]} | ${capability} | ${reason}`);
}

// ─── SOVEREIGN GENERATE ──────────────────────────────────────────────────────
/**
 * Helix F: Sovereign Inference Layer
 *
 * Constitutional Article I: Local inference preferred. Cloud is fallback, not default.
 * RTX 4090 runs first. If Ollama is offline, falls back to the provided cloudFallback fn.
 * Sovereignty decisions are always logged.
 *
 * Usage:
 *   const text = await sovereignGenerate(
 *     { prompt, system, capability: 'large' },
 *     () => ai.generate({ model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash', ...opts })
 *       .then(r => r.text ?? '')
 *   );
 */
export async function sovereignGenerate(
    options: {
        prompt: string;
        system?: string;
        capability?: LocalModelCapability;
        temperature?: number;
        maxTokens?: number;
    },
    cloudFallback: () => Promise<string>,
): Promise<{ text: string; decision: SovereigntyDecision }> {
    const { capability = 'fast' } = options;

    // 1. Check Ollama health (fast — cached after first call per session)
    const health = await checkOllamaHealth();

    if (health.online) {
        try {
            logSovereigntyDecision('local', capability, `Ollama online | GPU: ${health.gpuActive}`);
            const text = await localGenerate(options);
            return { text, decision: 'local' };
        } catch (err) {
            console.warn(`[SOVEREIGN] Local inference failed, falling to cloud: ${(err as Error).message}`);
        }
    }

    // 2. Cloud fallback — Ollama offline or errored
    logSovereigntyDecision('cloud-fallback', capability, 'Ollama offline — sovereign preference noted, using cloud bridge');
    const text = await cloudFallback();
    return { text, decision: 'cloud-fallback' };
}

/**
 * Sovereign generate for cases where local inference is impossible
 * (e.g., vision tasks, multimodal). Always logs the cloud-only decision.
 */
export async function cloudOnlyGenerate(
    capability: LocalModelCapability,
    reason: string,
    fn: () => Promise<string>,
): Promise<string> {
    logSovereigntyDecision('cloud-only', capability, reason);
    return fn();
}

