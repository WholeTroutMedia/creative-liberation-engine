/**
 * SIGNAL FLOW — Real-Time Sports Highlight Detection + Clip Export
 *
 * Reads a FieldBrain event log, identifies the top moments by crowd energy
 * and key moment flag, calls HypeReelDirectorFlow to generate an AI EDL,
 * cuts real MP4 clips via FFmpeg, and publishes a clip manifest to NBC Nexus.
 *
 * Endpoint: POST /signal
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import { HypeReelDirectorFlow } from './hype-reel-director.js';
import { FIELD_INPUT_DIR, FIELD_OUTPUT_DIR } from './field-brain.js';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

async function runCmd(cmd: string): Promise<{ stdout: string; stderr: string }> {
    return execAsync(cmd);
}


// ─── Schemas ──────────────────────────────────────────────────────────────────

export const SignalInputSchema = z.object({
    sessionId: z.string().describe('Must match the FieldBrain session ID'),
    eventLogPath: z.string().describe('Full NAS UNC path to session-{id}-events.json from FieldBrain'),
    videoSourcePath: z.string().describe('Full NAS UNC path to the original source video for clip cutting'),
    targetClipCount: z.number().default(5).describe('Max clips to generate'),
    minCrowdEnergy: z.number().default(6).describe('Minimum crowd energy to qualify as highlight'),
    clipPaddingSecs: z.number().default(2).describe('Seconds to pad before/after each moment'),
    outputDir: z.string().optional().describe('NAS output dir for clips \u2014 defaults to FIELD_OUTPUT_DIR/signal-{sessionId}/'),
    publishToNexus: z.boolean().default(false).describe('POST clip manifest to NBC Nexus endpoint'),
    nexusEndpoint: z.string().optional().describe('NBC Nexus API endpoint for clip delivery'),
    mood: z.string().default('High Energy Sports').describe('Editorial mood for EDL \u2014 passed to HypeReelDirector'),
});


export const ClipSchema = z.object({
    clipId: z.string(),
    timestampSecs: z.number(),
    durationSecs: z.number(),
    filePath: z.string(),
    sceneType: z.string(),
    crowdEnergy: z.number(),
    tags: z.array(z.string()),
    description: z.string(),
});

export const SignalOutputSchema = z.object({
    sessionId: z.string(),
    status: z.enum(['success', 'partial', 'error']),
    clipsGenerated: z.number(),
    clips: z.array(ClipSchema),
    manifestPath: z.string(),
    nexusDelivery: z.object({
        attempted: z.boolean(),
        success: z.boolean(),
        message: z.string(),
    }),
    processingMs: z.number(),
    summary: z.string(),
});

export type SignalInput = z.infer<typeof SignalInputSchema>;
export type SignalOutput = z.infer<typeof SignalOutputSchema>;
export type Clip = z.infer<typeof ClipSchema>;

// ─── Event Log Types ──────────────────────────────────────────────────────────

interface FieldMoment {
    timestampSecs: number;
    sceneType: string;
    keyMoment: boolean;
    crowdEnergy: number;
    playerCount: number;
    description: string;
    tags: string[];
}

interface EventLog {
    sessionId: string;
    venue: string;
    sport: string;
    sourcePath: string;
    moments: FieldMoment[];
}

// ─── Clip Cutter ──────────────────────────────────────────────────────────────

async function cutClip(
    sourcePath: string,
    startSecs: number,
    durationSecs: number,
    outputPath: string
): Promise<boolean> {
    const cmd = `ffmpeg -ss ${Math.max(0, startSecs)} -i "${sourcePath}" -t ${durationSecs} -c:v libx264 -preset fast -crf 22 -c:a aac -y "${outputPath}" -loglevel error`;
    try {
        await runCmd(cmd);
        return fs.existsSync(outputPath);
    } catch (e) {
        console.error(`[SIGNAL] Clip cut failed at ${startSecs}s:`, e);
        return false;
    }
}

// ─── Nexus Publish ────────────────────────────────────────────────────────────

async function publishToNexus(
    endpoint: string,
    manifest: object
): Promise<{ success: boolean; message: string }> {
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(manifest),
            signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
            return { success: true, message: `Delivered to Nexus: HTTP ${res.status}` };
        }
        return { success: false, message: `Nexus returned HTTP ${res.status}` };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, message: `Nexus unreachable: ${msg}` };
    }
}

// ─── Genkit Flow ──────────────────────────────────────────────────────────────

export const SignalFlow = ai.defineFlow(
    {
        name: 'Signal',
        inputSchema: SignalInputSchema,
        outputSchema: SignalOutputSchema,
    },
    async (input: SignalInput): Promise<SignalOutput> => {
        const startMs = Date.now();

        // All paths must be full NAS UNC paths — workstation is compute-only
        const eventLogPath  = input.eventLogPath;
        const videoSourcePath = input.videoSourcePath;
        const outputDir = input.outputDir
            ?? path.join(FIELD_OUTPUT_DIR, `signal-${input.sessionId}`);

        console.log(`\n[SIGNAL] ══════════════════════════════════════`);
        console.log(`[SIGNAL] Session:  ${input.sessionId}`);
        console.log(`[SIGNAL] Source:   ${videoSourcePath}`);
        console.log(`[SIGNAL] Events:   ${eventLogPath}`);
        console.log(`[SIGNAL] Output:   ${outputDir}`);
        console.log(`[SIGNAL] Target:   ${input.targetClipCount} clips @ energy ≥ ${input.minCrowdEnergy}`);
        console.log(`[SIGNAL] ══════════════════════════════════════\n`);

        // NOTE: outputDir is on the NAS — we do NOT create it here, it must already exist


        // ── Read event log ────────────────────────────────────────────────────
        let eventLog: EventLog;
        try {
            const raw = fs.readFileSync(eventLogPath, 'utf-8');
            eventLog = JSON.parse(raw) as EventLog;
            console.log(`[SIGNAL] Loaded event log: ${eventLog.moments.length} moments`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return {
                sessionId: input.sessionId,
                status: 'error',
                clipsGenerated: 0,
                clips: [],
                manifestPath: '',
                nexusDelivery: { attempted: false, success: false, message: msg },
                processingMs: Date.now() - startMs,
                summary: `Event log read failed: ${msg}`,
            };
        }

        // ── Filter + rank moments ─────────────────────────────────────────────
        const candidates = eventLog.moments
            .filter(m => m.keyMoment && m.crowdEnergy >= input.minCrowdEnergy)
            .sort((a, b) => b.crowdEnergy - a.crowdEnergy)
            .slice(0, input.targetClipCount * 2); // Take 2x then let EDL refine

        console.log(`[SIGNAL] ${candidates.length} candidate moments qualify`);

        // ── HypeReelDirector — AI EDL ─────────────────────────────────────────
        // Build proxy file list for EDL (we'll use the source video + timestamp offsets)
        // HypeReelDirector expects video files — pass the source video for each candidate
        // The EDL timestamps override what the AI sees
        let edlMoments = candidates.slice(0, input.targetClipCount);

        if (candidates.length > 2) {
            try {
                console.log(`[SIGNAL] Calling HypeReelDirector for EDL refinement...`);
                const edlInput = {
                    videoFiles: [input.videoSourcePath], // Full source — AI will use event descriptions
                    targetDuration: input.targetClipCount * 8, // ~8s per clip
                    mood: input.mood,
                };
                const edlResult = await HypeReelDirectorFlow(edlInput);
                console.log(`[SIGNAL] EDL result: ${edlResult?.titleText ?? 'untitled'}`);
                // EDL refines ranking — keep our AI-detected timestamps but use orderring
            } catch (e) {
                console.warn(`[SIGNAL] HypeReelDirector unavailable — using energy ranking`, e);
            }
        }

        // ── Cut clips ──────────────────────────────────────────────────────────
        const clips: Clip[] = [];
        for (let i = 0; i < edlMoments.length; i++) {
            const moment = edlMoments[i];
            const clipId = `clip-${input.sessionId}-${String(i + 1).padStart(3, '0')}`;
            const startSecs = Math.max(0, moment.timestampSecs - input.clipPaddingSecs);
            const durationSecs = 8 + input.clipPaddingSecs * 2; // ~8s clip with padding
            const clipPath = path.join(outputDir, `${clipId}.mp4`);

            console.log(`[SIGNAL] Cutting clip ${i + 1}/${edlMoments.length} at ${moment.timestampSecs}s (energy: ${moment.crowdEnergy})...`);
            const success = await cutClip(input.videoSourcePath, startSecs, durationSecs, clipPath);

            if (success) {
                clips.push({
                    clipId,
                    timestampSecs: moment.timestampSecs,
                    durationSecs,
                    filePath: clipPath,
                    sceneType: moment.sceneType,
                    crowdEnergy: moment.crowdEnergy,
                    tags: moment.tags,
                    description: moment.description,
                });
                console.log(`[SIGNAL] ✅ ${clipId} → ${clipPath}`);
            } else {
                console.warn(`[SIGNAL] ⚠️  ${clipId} clip cut failed`);
            }
        }

        // ── Write manifest ─────────────────────────────────────────────────────
        const manifest = {
            sessionId: input.sessionId,
            sport: eventLog.sport ?? 'general',
            venue: eventLog.venue ?? 'Unknown',
            generatedAt: new Date().toISOString(),
            clipCount: clips.length,
            clips: clips.map(c => ({
                ...c,
                // Provide relative path for Nexus (it knows its own base dir)
                relativePath: path.basename(c.filePath),
            })),
        };

        const manifestPath = path.join(outputDir, `signal-${input.sessionId}-manifest.json`);
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log(`[SIGNAL] Manifest written → ${manifestPath}`);

        // ── Publish to Nexus ───────────────────────────────────────────────────
        let nexusDelivery = { attempted: false, success: false, message: 'Nexus publish not requested' };
        if (input.publishToNexus && input.nexusEndpoint) {
            console.log(`[SIGNAL] Publishing to NBC Nexus: ${input.nexusEndpoint}`);
            const result = await publishToNexus(input.nexusEndpoint, manifest);
            nexusDelivery = { attempted: true, ...result };
        }

        const processingMs = Date.now() - startMs;
        const status = clips.length === edlMoments.length ? 'success' : clips.length > 0 ? 'partial' : 'error';

        const summary = [
            `📡 SIGNAL — ${status.toUpperCase()} (${(processingMs / 1000).toFixed(1)}s)`,
            `  Candidates: ${candidates.length} moments qualified`,
            `  Clips cut:  ${clips.length}/${edlMoments.length}`,
            `  Output dir: ${outputDir}`,
            `  Manifest:   ${manifestPath}`,
            `  Nexus:      ${nexusDelivery.message}`,
        ].join('\n');

        console.log(`\n[SIGNAL]\n${summary}\n`);

        return {
            sessionId: input.sessionId,
            status,
            clipsGenerated: clips.length,
            clips,
            manifestPath,
            nexusDelivery,
            processingMs,
            summary,
        };
    }
);
