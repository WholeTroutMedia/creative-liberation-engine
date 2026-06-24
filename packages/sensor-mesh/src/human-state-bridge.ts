/**
 * @cle/sensor-mesh — HumanStateBridge
 *
 * Runtime adapter between BiometricBridge and the HumanStateContext type.
 *
 * This is the single bridge between raw sensor data and the Genkit
 * inference layer. Call getHumanStateContext() in any Genkit flow to
 * receive a ready-to-inject context object.
 *
 * Usage:
 *   import { getHumanStateContext } from '@cle/sensor-mesh/human-state-bridge';
 *   const humanState = await getHumanStateContext();
 *   const systemCtx = serializeHumanStateForPrompt(humanState);
 *
 * Transport:
 *   Primary:  HTTP GET http://localhost:8765/latest (BiometricBridge REST endpoint)
 *   Fallback: offlineHumanState() — never blocks flow execution
 *
 * Constitutional: Article XX (zero wait), Article XXIV (biometric privacy)
 *
 * @package @cle/sensor-mesh
 * @since 1.1.0
 */

import {
    type HumanStateContext,
    type BiometricConsentMode,
    HumanStateContextSchema,
    computeCognitiveLoad,
    computeRoutingHint,
    getConsentMode,
    offlineHumanState,
} from './HumanStateContext.js';
import { BiometricBriefSchema, type BiometricBrief } from './types.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const BRIDGE_BASE_URL = process.env.BIOMETRIC_BRIDGE_URL ?? 'http://localhost:8765';
const FETCH_TIMEOUT_MS = 2000; // Never slow down an agent flow

// ─── In-memory cache ──────────────────────────────────────────────────────────

interface CachedBrief {
    brief: BiometricBrief;
    capturedAt: number; // epoch ms
}

let _cache: CachedBrief | null = null;
const CACHE_TTL_MS = 10_000; // 10 seconds — biometric data doesn't change faster

// ─── Core Fetch ───────────────────────────────────────────────────────────────

/**
 * Fetch the latest BiometricBrief from BiometricBridge REST endpoint.
 * Returns null if the bridge is offline or times out.
 */
async function fetchLatestBrief(): Promise<BiometricBrief | null> {
    // Serve from cache if fresh
    if (_cache && Date.now() - _cache.capturedAt < CACHE_TTL_MS) {
        return _cache.brief;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const res = await fetch(`${BRIDGE_BASE_URL}/latest`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });
        clearTimeout(timer);

        if (!res.ok) {
            console.warn(`[HumanStateBridge] Bridge returned ${res.status} — offline fallback`);
            return null;
        }

        const raw = await res.json();
        const parsed = BiometricBriefSchema.safeParse(raw);

        if (!parsed.success) {
            console.warn('[HumanStateBridge] Invalid BiometricBrief payload:', parsed.error.message);
            return null;
        }

        _cache = { brief: parsed.data, capturedAt: Date.now() };
        return parsed.data;

    } catch (err: unknown) {
        clearTimeout(timer);
        if (err instanceof Error && err.name === 'AbortError') {
            console.warn('[HumanStateBridge] Fetch timed out — bridge offline');
        }
        return null;
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Materialize a HumanStateContext from live sensor data.
 *
 * Always returns instantly — degraded state if sensors offline.
 * Never throws. This is a system-level function called in hot paths.
 */
export async function getHumanStateContext(): Promise<HumanStateContext> {
    const consentMode: BiometricConsentMode = getConsentMode();

    // Privacy gate: if silent, return minimal offline context — no sensor fetch
    if (consentMode === 'silent') {
        return offlineHumanState();
    }

    const brief = await fetchLatestBrief();

    if (!brief) {
        return offlineHumanState();
    }

    const cognitiveLoad = computeCognitiveLoad(brief.hrv, brief.bpm, brief.motionIntensity);
    const routingHint = computeRoutingHint(cognitiveLoad, brief.mood);

    const ctx: HumanStateContext = HumanStateContextSchema.parse({
        biometrics: brief,
        cognitiveLoad,
        mood: brief.mood,
        routingHint,
        consentMode,
        capturedAt: new Date(brief.timestamp ?? Date.now()).toISOString(),
        activeSources: brief.sources ?? [],
        isFresh: true,
    });

    return ctx;
}

/**
 * Invalidate the biometric cache. Call when sensors reconnect or
 * when a flow explicitly needs a fresh reading.
 */
export function invalidateBiometricCache(): void {
    _cache = null;
    console.log('[HumanStateBridge] Cache invalidated — next call fetches fresh data');
}

/**
 * Health check: is the BiometricBridge REST endpoint reachable?
 */
export async function isBiometricBridgeOnline(): Promise<boolean> {
    const brief = await fetchLatestBrief();
    return brief !== null;
}
