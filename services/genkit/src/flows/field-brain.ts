/**
 * FIELD BRAIN — Edge Node AI Ingest Flow
 *
 * The intelligence layer that runs on a Pi 5 / ALPON X5 AI edge node at a live
 * sports venue. Ingests any video source, samples frames, runs Gemini multimodal
 * AI analysis, generates structured event metadata, and routes everything to the
 * NAS — autonomously, without a human hand in the chain.
 *
 * Part of the BROADCAST hive. ATLAS sets editorial direction.
 * SYSTEMS agent orchestrates the ingest pipeline.
 *
 * Endpoint: POST /field-brain
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// ─── NAS I/O Paths ────────────────────────────────────────────────────────────
// Workstation = compute only. All input and output live on the NAS.
// Override via env vars; defaults target the barnstorm live-ingest share.
//
// Windows UNC:  \\127.0.0.1\raw backups\2026\barnstorm\field-input
// macOS/Linux:  /Volumes/raw-backups/2026/barnstorm/field-input  (or /mnt/nas/...)

export const FIELD_INPUT_DIR  = process.env['FIELD_INPUT_DIR']  ?? '\\\\127.0.0.1\\raw backups\\2026\\barnstorm\\field-input';
export const FIELD_OUTPUT_DIR = process.env['FIELD_OUTPUT_DIR'] ?? '\\\\127.0.0.1\\raw backups\\2026\\barnstorm\\field-output';

// NOTE: NAS dirs are NOT created by this process — they must exist on the NAS.
// The workstation never writes metadata to local disk (only temp frames at %TEMP%).


// ─── Schemas ──────────────────────────────────────────────────────────────────

export const FieldBrainInputSchema = z.object({
    sessionId: z.string().describe('Unique session identifier e.g. "sharks-2026-03-30-p1"'),
    sourceType: z.enum(['file', 'rtmp', 'hls', 'usb']).default('file'),
    sourcePath: z.string().describe('Full UNC path on NAS or RTMP/HLS URL — e.g. "\\\\127.0.0.1\\raw backups\\...\\game.mp4"'),
    sport: z.enum(['hockey', 'baseball', 'basketball', 'soccer', 'tennis', 'general']).default('general'),
    venue: z.string().default('Unknown Venue').describe('Venue name e.g. "Chase Center"'),
    nasIngestPath: z.string().optional().describe('NAS output dir for event log sync — defaults to FIELD_OUTPUT_DIR env var'),
    outputDir: z.string().optional().describe('Override output dir — defaults to FIELD_OUTPUT_DIR env var (NAS)'),
    samplingIntervalSecs: z.number().default(5).describe('Frame sample interval in seconds'),
    maxDurationSecs: z.number().optional().describe('Max seconds of source to analyze — omit for full file'),
    nodeId: z.string().optional().describe('Edge node hardware ID for dispatch heartbeat'),
    dispatchEndpoint: z.string().default('http://localhost:5150').describe('CLE dispatch server URL'),
});

export const FieldMomentSchema = z.object({
    timestampSecs: z.number().describe('Timestamp in source video'),
    sceneType: z.string().describe('e.g. "goal", "faceoff", "crowd", "bench", "replay", "timeout"'),
    keyMoment: z.boolean().describe('True if this is a highlight-worthy moment'),
    crowdEnergy: z.number().min(0).max(10).describe('Crowd energy estimate 0-10'),
    playerCount: z.number().describe('Visible players in frame'),
    description: z.string().describe('Brief AI description of what is happening'),
    tags: z.array(z.string()).describe('Sport-specific tags'),
});

export const FieldBrainOutputSchema = z.object({
    sessionId: z.string(),
    venue: z.string(),
    sport: z.string(),
    status: z.enum(['success', 'partial', 'error']),
    framesAnalyzed: z.number(),
    keyMomentsDetected: z.number(),
    moments: z.array(FieldMomentSchema),
    eventLogPath: z.string().describe('Path where event JSON was written'),
    nasSync: z.object({
        attempted: z.boolean(),
        success: z.boolean(),
        message: z.string(),
    }),
    processingMs: z.number(),
    summary: z.string(),
});

export type FieldBrainInput = z.infer<typeof FieldBrainInputSchema>;
export type FieldBrainOutput = z.infer<typeof FieldBrainOutputSchema>;
export type FieldMoment = z.infer<typeof FieldMomentSchema>;

// ─── Sport-Specific System Prompts ────────────────────────────────────────────

const SPORT_PROMPTS: Record<string, string> = {
    hockey: 'You are analyzing NHL hockey footage. Key moments: goals, saves, fights, power plays, penalty shots, crowd reactions to scoring. A "goal" is the highest-value moment. Faceoffs = routine. Crowd energy spikes at goals and fights.',
    basketball: 'You are analyzing NBA basketball footage. Key moments: dunks, three-pointers, blocks, game-winning plays, crowd surges, timeouts with score close. Crowd energy spikes on dunks and close-game plays.',
    baseball: 'You are analyzing MLB baseball footage. Key moments: home runs, strikeouts, diving catches, base-clearing hits, pitching changes with score close. Crowd energy spikes on home runs and game-changing plays.',
    soccer: 'You are analyzing soccer/football footage. Key moments: goals, near-misses, saves, red cards, penalty kicks, corner kicks in tight games. Goals are the rarest and most valuable.',
    tennis: 'You are analyzing tennis footage. Key moments: aces, break points, game-winning rallies, player reactions, disputed line calls. Crowd energy is quieter — spikes on aces and match points.',
    general: 'You are analyzing live event footage. Identify the most visually dynamic and emotionally significant moments. Look for sudden action, crowd reactions, and performance peaks.',
};

// ─── Frame Extraction ─────────────────────────────────────────────────────────

async function extractFrames(
    sourcePath: string,
    intervalSecs: number,
    maxDurationSecs: number | undefined,
    tmpDir: string
): Promise<string[]> {
    const durationFlag = maxDurationSecs ? `-t ${maxDurationSecs}` : '';
    const outputPattern = path.join(tmpDir, 'frame_%04d.jpg');

    // Use FFmpeg to extract keyframes at interval — requires ffmpeg in PATH
    const cmd = `ffmpeg -i "${sourcePath}" ${durationFlag} -vf "fps=1/${intervalSecs},scale=960:-1" -q:v 3 -y "${outputPattern}" -loglevel error`;

    try {
        await execAsync(cmd);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // FFmpeg may exit non-zero even on success — check if frames were written
        const frames = fs.readdirSync(tmpDir).filter(f => f.startsWith('frame_') && f.endsWith('.jpg'));
        if (frames.length === 0) {
            throw new Error(`FFmpeg frame extraction failed: ${msg}`);
        }
    }

    return fs.readdirSync(tmpDir)
        .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'))
        .sort()
        .map(f => path.join(tmpDir, f));
}

// ─── Dispatch Heartbeat ───────────────────────────────────────────────────────

async function sendHeartbeat(
    dispatchEndpoint: string,
    sessionId: string,
    nodeId: string | undefined,
    status: string,
    keyMomentsDetected: number
): Promise<void> {
    try {
        const res = await fetch(`${dispatchEndpoint}/api/agents/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: nodeId ?? `field-brain-${sessionId}`,
                agentType: 'field-brain',
                sessionId,
                status,
                metadata: { keyMomentsDetected },
                timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) console.warn(`[FIELD-BRAIN] Dispatch heartbeat HTTP ${res.status}`);
        else console.log(`[FIELD-BRAIN] ✅ Heartbeat sent — ${status}, ${keyMomentsDetected} moments`);
    } catch {
        console.warn(`[FIELD-BRAIN] Dispatch offline — heartbeat skipped`);
    }
}

// ─── NAS Sync ─────────────────────────────────────────────────────────────────

async function syncToNas(
    localPath: string,
    nasIngestPath: string
): Promise<{ success: boolean; message: string }> {
    // On Windows: use robocopy. On Linux/Mac (Pi): use rsync
    const isWindows = os.platform() === 'win32';
    const fileName = path.basename(localPath);

    try {
        if (isWindows) {
            const localDir = path.dirname(localPath);
            const cmd = `robocopy "${localDir}" "${nasIngestPath}" "${fileName}" /NJH /NJS /NDL /NC /NS`;
            execSync(cmd, { stdio: 'pipe' });
        } else {
            const cmd = `rsync -av "${localPath}" "${nasIngestPath}/"`;
            await execAsync(cmd);
        }
        return { success: true, message: `Synced ${fileName} to ${nasIngestPath}` };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // robocopy exits 1 on success (files copied) — treat that as success
        if (isWindows && msg.includes('exit code 1')) {
            return { success: true, message: `Synced ${fileName} to ${nasIngestPath}` };
        }
        return { success: false, message: `Sync failed: ${msg.slice(0, 200)}` };
    }
}

// ─── Genkit Flow ──────────────────────────────────────────────────────────────

export const FieldBrainFlow = ai.defineFlow(
    {
        name: 'FieldBrain',
        inputSchema: FieldBrainInputSchema,
        outputSchema: FieldBrainOutputSchema,
    },
    async (input: FieldBrainInput): Promise<FieldBrainOutput> => {
        const startMs = Date.now();
        const outputDir = input.outputDir ?? FIELD_OUTPUT_DIR;
        // Temp frames stay local — extracted to OS temp and cleaned up after analysis.
        // Workstation is compute-only; all persistent I/O is on the NAS.
        const tmpFrameDir = path.join(os.tmpdir(), `field-brain-${input.sessionId}-frames`);
        const sourcePath = input.sourcePath; // Must be a full UNC path or URL — no local fallback

        console.log(`\n[FIELD-BRAIN] ══════════════════════════════════════`);
        console.log(`[FIELD-BRAIN] Session: ${input.sessionId}`);
        console.log(`[FIELD-BRAIN] Venue:   ${input.venue} | Sport: ${input.sport}`);
        console.log(`[FIELD-BRAIN] Source:  ${sourcePath}`);
        console.log(`[FIELD-BRAIN] Output:  ${outputDir}`);
        console.log(`[FIELD-BRAIN] ══════════════════════════════════════\n`);

        // Ensure temp frame directory exists (local-only, cleaned up after)
        if (!fs.existsSync(tmpFrameDir)) fs.mkdirSync(tmpFrameDir, { recursive: true });
        // NOTE: we do NOT mkdirSync(outputDir) — NAS dirs must already exist

        // ── Extract frames ────────────────────────────────────────────────────
        let framePaths: string[] = [];
        try {
            console.log(`[FIELD-BRAIN] Extracting frames (1 per ${input.samplingIntervalSecs}s)...`);
            framePaths = await extractFrames(
                sourcePath,
                input.samplingIntervalSecs,
                input.maxDurationSecs,
                tmpFrameDir
            );
            console.log(`[FIELD-BRAIN] ${framePaths.length} frames extracted`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[FIELD-BRAIN] Frame extraction error: ${msg}`);
            // FFmpeg not available or file issue — return graceful error
            return {
                sessionId: input.sessionId,
                venue: input.venue,
                sport: input.sport,
                status: 'error',
                framesAnalyzed: 0,
                keyMomentsDetected: 0,
                moments: [],
                eventLogPath: '',
                nasSync: { attempted: false, success: false, message: msg },
                processingMs: Date.now() - startMs,
                summary: `Frame extraction failed: ${msg}`,
            };
        }

        // ── Batch frames for Gemini analysis (max 20 per call to stay within limits) ──
        const BATCH_SIZE = 20;
        const moments: FieldMoment[] = [];
        const sportPrompt = SPORT_PROMPTS[input.sport] ?? SPORT_PROMPTS.general;

        for (let batchStart = 0; batchStart < framePaths.length; batchStart += BATCH_SIZE) {
            const batch = framePaths.slice(batchStart, batchStart + BATCH_SIZE);
            const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
            console.log(`[FIELD-BRAIN] AI analysis batch ${batchNum} (${batch.length} frames)...`);

            const mediaParts = batch.flatMap((fp, i) => {
                const frameIdxSecs = (batchStart + i) * input.samplingIntervalSecs;
                const frameData = fs.readFileSync(fp);
                const base64 = frameData.toString('base64');
                return [
                    { text: `\n--- FRAME at ${frameIdxSecs}s ---` },
                    { media: { url: `data:image/jpeg;base64,${base64}`, contentType: 'image/jpeg' } },
                ];
            });

            const outputSchema = z.object({
                frames: z.array(z.object({
                    timestampSecs: z.number(),
                    sceneType: z.string(),
                    keyMoment: z.boolean(),
                    crowdEnergy: z.number(),
                    playerCount: z.number(),
                    description: z.string(),
                    tags: z.array(z.string()),
                })),
            });

            try {
                const { output } = await ai.generate({
                    model: process.env.GENKIT_DEFAULT_MODEL ?? 'googleai/gemini-2.5-flash',
                    system: `${sportPrompt}
                    
You are analyzing frames from a live ${input.sport} event at ${input.venue}.
For EACH frame provided, analyze and return structured data.
Be precise about timestamps — use the label from each frame header.
Only mark keyMoment=true for genuinely highlight-worthy moments unlikely to be missed on a broadcast.`,
                    messages: [{
                        role: 'user',
                        content: [
                            ...mediaParts,
                            {
                                text: `Analyze all ${batch.length} frames above. Return a JSON object with a "frames" array, one entry per frame, with fields: timestampSecs (number), sceneType (string), keyMoment (boolean), crowdEnergy (0-10 number), playerCount (number), description (string), tags (string array).`
                            }
                        ],
                    }],
                    output: { schema: outputSchema, format: 'json' },
                    config: { temperature: 0.2 },
                });

                if (output?.frames) {
                    moments.push(...output.frames);
                }
            } catch (e) {
                console.error(`[FIELD-BRAIN] Batch ${batchNum} analysis failed:`, e);
                // Continue with remaining batches — sovereign fallback
            }
        }

        // ── Write event log ───────────────────────────────────────────────────
        const keyMoments = moments.filter(m => m.keyMoment);
        const eventLog = {
            sessionId: input.sessionId,
            venue: input.venue,
            sport: input.sport,
            sourcePath: input.sourcePath,
            generatedAt: new Date().toISOString(),
            framesAnalyzed: framePaths.length,
            keyMomentsDetected: keyMoments.length,
            moments,
        };

        const eventLogPath = path.join(outputDir, `session-${input.sessionId}-events.json`);
        fs.writeFileSync(eventLogPath, JSON.stringify(eventLog, null, 2));
        console.log(`[FIELD-BRAIN] Event log written → ${eventLogPath}`);

        // ── NAS Sync ──────────────────────────────────────────────────────────
        let nasSync = { attempted: false, success: false, message: 'NAS path not configured' };
        if (input.nasIngestPath) {
            console.log(`[FIELD-BRAIN] Syncing to NAS: ${input.nasIngestPath}`);
            const syncResult = await syncToNas(eventLogPath, input.nasIngestPath);
            nasSync = { attempted: true, ...syncResult };
        }

        // ── Cleanup temp frames ───────────────────────────────────────────────
        try {
            fs.rmSync(tmpFrameDir, { recursive: true, force: true });
        } catch { /* non-critical */ }

        // ── Dispatch heartbeat ────────────────────────────────────────────────
        const finalStatus = moments.length > 0 ? 'success' : 'partial';
        await sendHeartbeat(
            input.dispatchEndpoint,
            input.sessionId,
            input.nodeId,
            finalStatus,
            keyMoments.length
        );

        const processingMs = Date.now() - startMs;
        const summary = [
            `🎥 FIELD BRAIN — ${finalStatus.toUpperCase()} (${(processingMs / 1000).toFixed(1)}s)`,
            `  Venue:    ${input.venue} | Sport: ${input.sport}`,
            `  Frames:   ${framePaths.length} analyzed`,
            `  Moments:  ${keyMoments.length} key / ${moments.length} total`,
            `  Log:      ${eventLogPath}`,
            `  NAS:      ${nasSync.message}`,
        ].join('\n');

        console.log(`\n[FIELD-BRAIN]\n${summary}\n`);

        return {
            sessionId: input.sessionId,
            venue: input.venue,
            sport: input.sport,
            status: finalStatus,
            framesAnalyzed: framePaths.length,
            keyMomentsDetected: keyMoments.length,
            moments,
            eventLogPath,
            nasSync,
            processingMs,
            summary,
        };
    }
);
