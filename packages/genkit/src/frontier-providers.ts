/**
 * @cle/genkit — Frontier Provider Extensions
 * Wires Google AI Studio frontier/experimental models into the Engine.
 *
 * These capabilities are FREE under your Tier 2 API key (Ultra subscription).
 * They use the same GOOGLE_API_KEY / GEMINI_API_KEY as the standard Gemini models.
 *
 * ─── FRONTIER CAPABILITIES (2026-04-28) ────────────────────────────────────
 *   - Computer Use Preview  → 1,000 RPM  | Browser automation via AI
 *   - Deep Research Pro     → 10 RPM     | Autonomous multi-step research
 *   - Imagen 4 Generate     → 15 RPM     | Image generation
 *   - Imagen 4 Ultra        → 10 RPM     | High-quality image generation
 *   - Veo 3                 → 4 RPM      | Video generation
 *   - Lyria 3 Pro           → 500 RPM    | Music/audio generation
 *   - Gemini 2.5 Flash TTS  → 1,000 RPM  | Text-to-speech
 *   - Gemini Embedding 2    → 5,000 RPM  | Cloud embeddings
 *   - Native Audio Dialog   → Unlimited  | Real-time voice conversation
 *
 * Constitutional Article I: Sovereignty — local first, frontier for what local can't do.
 * Constitutional Article IX: No MVP — full frontier capability, not partial.
 */

// ─── FRONTIER MODEL CATALOG ─────────────────────────────────────────────────

export type FrontierCapability =
    | 'computer-use'
    | 'deep-research'
    | 'image-gen'
    | 'image-gen-ultra'
    | 'video-gen'
    | 'music-gen'
    | 'tts'
    | 'tts-pro'
    | 'embedding'
    | 'voice-dialog';

export interface FrontierModel {
    id: string;
    capability: FrontierCapability;
    rpmLimit: number;
    tpmLimit: number | null;
    category: string;
    description: string;
    apiEndpoint: 'generateContent' | 'streamGenerateContent' | 'predict' | 'generate';
}

export const FRONTIER_MODELS: Record<FrontierCapability, FrontierModel> = {
    'computer-use': {
        id: 'gemini-2.5-flash-preview-native-audio-dialog',
        capability: 'computer-use',
        rpmLimit: 1000,
        tpmLimit: 5_000_000,
        category: 'Agentic',
        description: 'AI-native browser automation — clicks, types, navigates without Playwright',
        apiEndpoint: 'generateContent',
    },
    'deep-research': {
        id: 'gemini-2.5-pro-deep-research',
        capability: 'deep-research',
        rpmLimit: 10,
        tpmLimit: 10_000_000,
        category: 'Agentic',
        description: 'Multi-step autonomous research with synthesis',
        apiEndpoint: 'generateContent',
    },
    'image-gen': {
        id: 'imagen-4.0-generate-001',
        capability: 'image-gen',
        rpmLimit: 15,
        tpmLimit: null,
        category: 'Media Generation',
        description: 'Imagen 4 — high-quality image generation',
        apiEndpoint: 'predict',
    },
    'image-gen-ultra': {
        id: 'imagen-4.0-ultra-generate-001',
        capability: 'image-gen-ultra',
        rpmLimit: 10,
        tpmLimit: null,
        category: 'Media Generation',
        description: 'Imagen 4 Ultra — highest quality image generation',
        apiEndpoint: 'predict',
    },
    'video-gen': {
        id: 'veo-3.0-generate-preview',
        capability: 'video-gen',
        rpmLimit: 4,
        tpmLimit: null,
        category: 'Media Generation',
        description: 'Veo 3 — text-to-video generation',
        apiEndpoint: 'predict',
    },
    'music-gen': {
        id: 'lyria-3.0-pro',
        capability: 'music-gen',
        rpmLimit: 500,
        tpmLimit: null,
        category: 'Media Generation',
        description: 'Lyria 3 Pro — music and audio generation',
        apiEndpoint: 'predict',
    },
    'tts': {
        id: 'gemini-2.5-flash-preview-tts',
        capability: 'tts',
        rpmLimit: 1000,
        tpmLimit: 100_000,
        category: 'Audio',
        description: 'Text-to-speech — fast, natural voice synthesis',
        apiEndpoint: 'generateContent',
    },
    'tts-pro': {
        id: 'gemini-2.5-pro-preview-tts',
        capability: 'tts-pro',
        rpmLimit: 250,
        tpmLimit: 25_000,
        category: 'Audio',
        description: 'Premium text-to-speech — highest quality voice',
        apiEndpoint: 'generateContent',
    },
    'embedding': {
        id: 'text-embedding-005',
        capability: 'embedding',
        rpmLimit: 5000,
        tpmLimit: 5_000_000,
        category: 'Embeddings',
        description: 'Gemini Embedding — cloud embeddings for RAG',
        apiEndpoint: 'generateContent',
    },
    'voice-dialog': {
        id: 'gemini-2.5-flash-preview-native-audio-dialog',
        capability: 'voice-dialog',
        rpmLimit: Infinity,
        tpmLimit: 10_000_000,
        category: 'Real-time',
        description: 'Native Audio Dialog — unlimited real-time voice',
        apiEndpoint: 'streamGenerateContent',
    },
};

// ─── RATE LIMIT TRACKER ─────────────────────────────────────────────────────

const rateLimitState: Record<string, { count: number; windowStart: number }> = {};

function checkRateLimit(capability: FrontierCapability): boolean {
    const model = FRONTIER_MODELS[capability];
    if (model.rpmLimit === Infinity) return true;

    const now = Date.now();
    const key = capability;
    const state = rateLimitState[key];

    if (!state || now - state.windowStart > 60_000) {
        rateLimitState[key] = { count: 1, windowStart: now };
        return true;
    }

    if (state.count >= model.rpmLimit) {
        console.warn(`[FRONTIER] ⚠️ Rate limit approaching for ${capability}: ${state.count}/${model.rpmLimit} RPM`);
        return false;
    }

    state.count++;
    return true;
}

// ─── FRONTIER GENERATE ──────────────────────────────────────────────────────

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

function getApiKey(): string {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) throw new Error('[FRONTIER] No API key configured — set GEMINI_API_KEY or GOOGLE_API_KEY');
    return key;
}

/**
 * Call a frontier Gemini model via the REST API.
 * Uses the same Tier 2 key — free within rate limits.
 */
export async function frontierGenerate(options: {
    capability: FrontierCapability;
    prompt: string;
    systemInstruction?: string;
    temperature?: number;
    maxTokens?: number;
}): Promise<{ text: string; model: string; capability: FrontierCapability }> {
    const { capability, prompt, systemInstruction, temperature = 0.7, maxTokens = 8192 } = options;
    const model = FRONTIER_MODELS[capability];

    if (!checkRateLimit(capability)) {
        throw new Error(`[FRONTIER] Rate limit exceeded for ${capability} (${model.rpmLimit} RPM)`);
    }

    const apiKey = getApiKey();
    const url = `${BASE_URL}/models/${model.id}:${model.apiEndpoint}?key=${apiKey}`;

    const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
        },
    };

    if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    console.log(`[FRONTIER] 🔬 ${capability} → ${model.id} | ...`);

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`[FRONTIER] ${capability} failed (${response.status}): ${error}`);
    }

    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    console.log(`[FRONTIER] ✅ ${capability} complete | ${text.length} chars`);
    return { text, model: model.id, capability };
}

// ─── CONVENIENCE WRAPPERS ───────────────────────────────────────────────────

/**
 * Autonomous deep research — feeds a topic, returns synthesized report.
 * 10 RPM limit. Use for high-value research tasks only.
 */
export async function deepResearch(topic: string, context?: string): Promise<string> {
    const { text } = await frontierGenerate({
        capability: 'deep-research',
        prompt: topic,
        systemInstruction: context ?? 'You are a thorough research agent. Provide comprehensive, well-sourced analysis.',
        maxTokens: 32768,
    });
    return text;
}

/**
 * Cloud embeddings — 5,000 RPM. Use when local nomic-embed-text
 * isn't sufficient or for batch embedding operations.
 */
export async function cloudEmbed(text: string): Promise<number[]> {
    const apiKey = getApiKey();
    const url = `${BASE_URL}/models/text-embedding-005:embedContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: { parts: [{ text }] },
            taskType: 'RETRIEVAL_DOCUMENT',
        }),
    });

    if (!response.ok) {
        throw new Error(`[FRONTIER] Embedding failed: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.embedding?.values ?? [];
}

// ─── CAPABILITY CHECKER ─────────────────────────────────────────────────────

/**
 * Check which frontier capabilities are available based on API key.
 */
export async function checkFrontierHealth(): Promise<{
    available: FrontierCapability[];
    apiKeyPresent: boolean;
    tier: string;
}> {
    const hasKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

    if (!hasKey) {
        return { available: [], apiKeyPresent: false, tier: 'none' };
    }

    // All frontier models use the same key — if key exists, all are available
    const available = Object.keys(FRONTIER_MODELS) as FrontierCapability[];

    return {
        available,
        apiKeyPresent: true,
        tier: 'tier-2', // Ultra subscription
    };
}

// ─── BOOT LOG ────────────────────────────────────────────────────────────────

export function logFrontierRegistry(): void {
    console.log('[FRONTIER] 🔬 Frontier model registry:');
    for (const [cap, model] of Object.entries(FRONTIER_MODELS)) {
        const rpm = model.rpmLimit === Infinity ? '∞' : `${model.rpmLimit}`;
        console.log(`  🧪 ${cap} → ${model.id} | ${rpm} RPM | ${model.category}`);
    }
}
