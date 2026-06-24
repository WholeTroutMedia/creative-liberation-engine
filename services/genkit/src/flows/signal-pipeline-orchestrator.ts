/**
 * Signal Pipeline Orchestrator — TD × Maxon × Tencent Top-Level Conductor
 *
 * Chains the full media pipeline:
 *   1. Hunyuan3DBridge  — AI 3D asset generation (prompt → FBX)
 *   2. VfxRendererFlow  — TouchDesigner VFX render (audio-reactive layer)
 *   3. Asset inject OSC — Push HY3D asset path to C4D via OSC
 *   4. TRTCBroadcast    — Open Tencent TRTC room + begin broadcast
 *
 * Parallel execution:
 *   Track A: HY3D generation (30–120s async)
 *   Track B: TD VFX render with current style (fires immediately)
 *   Track C: TRTC room pre-creation (fires immediately)
 *   On Track A complete → OSC inject asset into live TD/C4D scene
 *
 * All tracks are sovereign: each can fail gracefully without
 * bringing down the others, per Article I.
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import dgram from 'dgram';
import { Hunyuan3DBridgeFlow, Hunyuan3DInputSchema, type Hunyuan3DOutput } from './hunyuan-3d-bridge.js';
import { VfxRendererFlow, type VfxRendererInput } from './vfx-renderer.js';
import { TRTCBroadcastFlow, type TRTCBroadcastInput, type TRTCBroadcastOutput } from './trtc-broadcast.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const C4D_OSC_HOST = process.env.C4D_OSC_HOST || '127.0.0.1';
const C4D_OSC_PORT = parseInt(process.env.C4D_OSC_PORT || '7002', 10);
const TD_OSC_HOST = process.env.TD_OSC_HOST || '127.0.0.1';
const TD_OSC_PORT = parseInt(process.env.TD_OSC_PORT || '7000', 10);

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const SignalPipelineInputSchema = z.object({
    sessionId: z.string().describe('Master session identifier'),

    // Track A — Hunyuan 3D Asset
    assetPrompt: z.string().describe('Text prompt for Hunyuan 3D asset generation'),
    assetReferenceImageUrl: z.string().optional().describe('Optional reference image for HY3D'),
    assetFormat: z.enum(['glb', 'fbx']).default('fbx'),

    // Track B — TouchDesigner VFX
    bpm: z.number().default(128).describe('Audio BPM for TD audio-reactive sync'),
    vfxStyle: z.string().default('plasma').describe("VFX style: 'neon-glitch', 'plasma', 'chromatic', 'dark-matter'"),
    vfxDuration: z.number().default(60).describe('VFX duration in seconds'),
    vfxFormat: z.enum(['vertical', 'landscape', 'square']).default('landscape'),

    // Track C — TRTC Broadcast
    roomName: z.string().describe('Broadcast room name'),
    maxViewers: z.number().default(1000),
    resolution: z.enum(['720p', '1080p', '4K']).default('1080p'),

    // C4D param injection (sent when HY3D asset is ready)
    c4dMoGraphParams: z.record(z.number()).optional()
        .describe('MoGraph effector params to set in C4D: { effector_id: value }'),
});

export const SignalPipelineOutputSchema = z.object({
    sessionId: z.string(),

    trackA: z.object({
        status: z.string(),
        assetPath: z.string().nullable(),
        jobId: z.string().nullable(),
        generationMs: z.number().optional(),
    }).describe('Hunyuan 3D generation result'),

    trackB: z.object({
        status: z.string(),
        overlayPath: z.string().nullable(),
    }).describe('TouchDesigner VFX render result'),

    trackC: z.object({
        status: z.string(),
        roomId: z.string(),
        joinUrl: z.string(),
        fallbackMode: z.boolean(),
    }).describe('TRTC broadcast room result'),

    c4dInject: z.object({
        sent: z.boolean(),
        message: z.string(),
    }).describe('C4D OSC asset injection result'),

    overallStatus: z.enum(['all_live', 'partial', 'offline']),
    summary: z.string(),
    pipelineMs: z.number().describe('Total orchestration wall-clock time'),
});

export type SignalPipelineInput = z.infer<typeof SignalPipelineInputSchema>;
export type SignalPipelineOutput = z.infer<typeof SignalPipelineOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// OSC HELPERS — C4D Asset Inject
// ─────────────────────────────────────────────────────────────────────────────

function encodeOscString(str: string): Buffer {
    const buf = Buffer.from(str + '\0', 'utf-8');
    const rem = buf.length % 4;
    return rem === 0 ? buf : Buffer.concat([buf, Buffer.alloc(4 - rem)]);
}

function buildOscStringPacket(address: string, value: string): Buffer {
    const addrBuf = encodeOscString(address);
    const tagBuf = encodeOscString(',s');
    const valBuf = encodeOscString(value);
    return Buffer.concat([addrBuf, tagBuf, valBuf]);
}

async function sendC4DAssetInject(assetPath: string): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = dgram.createSocket('udp4');
        // /c4d/asset_inject — C4D Python listener imports FBX from this path
        const packet = buildOscStringPacket('/c4d/asset_inject', assetPath);

        socket.send(packet, C4D_OSC_PORT, C4D_OSC_HOST, (err) => {
            socket.close();
            if (err) {
                console.warn(`[PIPELINE] C4D OSC inject failed: ${err.message}`);
                resolve(false);
            } else {
                console.log(`[PIPELINE] ✅ C4D asset inject sent: ${assetPath} → ${C4D_OSC_HOST}:${C4D_OSC_PORT}`);
                resolve(true);
            }
        });
    });
}

async function sendC4DParams(params: Record<string, number>): Promise<void> {
    const socket = dgram.createSocket('udp4');
    for (const [effectorId, value] of Object.entries(params)) {
        const address = `/c4d/param/${effectorId}`;
        const addrBuf = encodeOscString(address);
        const tagBuf = encodeOscString(',f');
        const valBuf = Buffer.allocUnsafe(4);
        valBuf.writeFloatBE(value, 0);
        const packet = Buffer.concat([addrBuf, tagBuf, valBuf]);
        await new Promise<void>((resolve) => {
            socket.send(packet, TD_OSC_PORT, TD_OSC_HOST, () => resolve());
        });
        console.log(`[PIPELINE] C4D param: /c4d/param/${effectorId} = ${value}`);
    }
    socket.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// GENKIT FLOW
// ─────────────────────────────────────────────────────────────────────────────

export const SignalPipelineOrchestratorFlow = ai.defineFlow(
    {
        name: 'SignalPipelineOrchestrator',
        inputSchema: SignalPipelineInputSchema,
        outputSchema: SignalPipelineOutputSchema,
    },
    async (input: SignalPipelineInput): Promise<SignalPipelineOutput> => {
        const startMs = Date.now();
        console.log(`\n[PIPELINE] ══════════════════════════════════════════`);
        console.log(`[PIPELINE] Signal Pipeline Orchestrator — ${input.sessionId}`);
        console.log(`[PIPELINE] Track A: HY3D "${input.assetPrompt.slice(0, 40)}..."`);
        console.log(`[PIPELINE] Track B: TD VFX ${input.vfxStyle} @ ${input.bpm} BPM`);
        console.log(`[PIPELINE] Track C: TRTC room "${input.roomName}"`);
        console.log(`[PIPELINE] ══════════════════════════════════════════\n`);

        // ── Fire Tracks B and C immediately (don't wait for HY3D) ────────────
        const vfxInput: VfxRendererInput = {
            bpm: input.bpm,
            style: input.vfxStyle,
            durationSeconds: input.vfxDuration,
            format: input.vfxFormat,
            sessionId: input.sessionId,
        };
        const trtcInput: TRTCBroadcastInput = {
            sessionId: input.sessionId,
            roomName: input.roomName,
            sourceType: 'ndi',
            maxParticipants: input.maxViewers,
            resolution: input.resolution,
            recordSession: false,
        };

        // Parallel: VFX render + TRTC room setup + HY3D generation
        const [trackBResult, trackCResult, trackAResult] = await Promise.allSettled([
            VfxRendererFlow(vfxInput),
            TRTCBroadcastFlow(trtcInput),
            Hunyuan3DBridgeFlow({
                prompt: input.assetPrompt,
                referenceImageUrl: input.assetReferenceImageUrl,
                sessionId: input.sessionId,
                format: input.assetFormat,
                quality: 'standard',
            }),
        ]);

        // ── Extract results ───────────────────────────────────────────────────
        const trackA = trackAResult.status === 'fulfilled' ? trackAResult.value : null;
        const trackB = trackBResult.status === 'fulfilled' ? trackBResult.value : null;
        const trackC = trackCResult.status === 'fulfilled' ? trackCResult.value : null;

        if (trackAResult.status === 'rejected') console.error(`[PIPELINE] Track A failed: ${trackAResult.reason}`);
        if (trackBResult.status === 'rejected') console.error(`[PIPELINE] Track B failed: ${trackBResult.reason}`);
        if (trackCResult.status === 'rejected') console.error(`[PIPELINE] Track C failed: ${trackCResult.reason}`);

        // ── C4D Asset Injection (post HY3D) ───────────────────────────────────
        let c4dInjectSent = false;
        let c4dInjectMessage = 'No asset available to inject';

        if (trackA?.status === 'success' && trackA.assetPath) {
            console.log(`[PIPELINE] Track A complete — injecting asset into C4D...`);
            c4dInjectSent = await sendC4DAssetInject(trackA.assetPath);
            c4dInjectMessage = c4dInjectSent
                ? `Asset injected into C4D: ${trackA.assetPath}`
                : `C4D not reachable on OSC port ${C4D_OSC_PORT} — start C4D with OSC listener`;

            // Also send any MoGraph params
            if (input.c4dMoGraphParams && Object.keys(input.c4dMoGraphParams).length > 0) {
                await sendC4DParams(input.c4dMoGraphParams);
            }
        } else if (trackA?.status === 'offline') {
            c4dInjectMessage = 'HY3D offline — skipping C4D inject. Set TENCENT_CLOUD_API_KEY to enable.';
        }

        // ── Determine overall status ──────────────────────────────────────────
        const liveTracks = [trackA?.status === 'success', trackB?.status === 'success', trackC?.status === 'live'].filter(Boolean).length;
        const overallStatus = liveTracks === 3 ? 'all_live' : liveTracks > 0 ? 'partial' : 'offline';

        const pipelineMs = Date.now() - startMs;

        const summary = [
            `🎬 Signal Pipeline — ${overallStatus.toUpperCase()} (${(pipelineMs / 1000).toFixed(1)}s)`,
            `  A (HY3D):  ${trackA?.status ?? 'failed'} ${trackA?.assetPath ? `→ ${trackA.assetPath.split('\\').pop()}` : ''}`,
            `  B (VFX):   ${trackB?.status ?? 'failed'} ${trackB?.overlayPath ? `→ ${trackB.overlayPath.split('\\').pop()}` : ''}`,
            `  C (TRTC):  ${trackC?.status ?? 'failed'} ${trackC?.joinUrl ? `→ ${trackC.roomId}` : ''}`,
            `  Inject:    ${c4dInjectSent ? '✅' : '⚠️ '} ${c4dInjectMessage}`,
        ].join('\n');

        console.log(`\n[PIPELINE]\n${summary}\n`);

        return {
            sessionId: input.sessionId,
            trackA: {
                status: trackA?.status ?? 'failed',
                assetPath: trackA?.assetPath ?? null,
                jobId: trackA?.jobId ?? null,
                generationMs: trackA?.generationMs,
            },
            trackB: {
                status: trackB?.status ?? 'failed',
                overlayPath: trackB?.overlayPath ?? null,
            },
            trackC: {
                status: trackC?.status ?? 'failed',
                roomId: trackC?.roomId ?? '',
                joinUrl: trackC?.joinUrl ?? '',
                fallbackMode: trackC?.fallbackMode ?? true,
            },
            c4dInject: { sent: c4dInjectSent, message: c4dInjectMessage },
            overallStatus,
            summary,
            pipelineMs,
        };
    }
);
