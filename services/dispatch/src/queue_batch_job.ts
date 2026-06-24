/**
 * packages/dispatch/src/queue_batch_job.ts
 * Creative Liberation Engine — ComfyUI Batch Job Submitter
 *
 * Submits a batch video-to-video ComfyUI job with:
 *   1. Job manifest written to D: BEFORE submission (survives crashes/power events)
 *   2. Parameterized workflow JSON patched at runtime (video path, fps, checkpoint, denoise)
 *   3. Poll loop waiting for ComfyUI queue to drain
 *   4. Manifest updated with output path and duration on completion
 *
 * Usage:
 *   npx tsx src/queue_batch_job.ts \
 *     --video "D:/path/to/input.mp4" \
 *     --output-fps 24 \
 *     --checkpoint "v1-5-pruned-emaonly.ckpt" \
 *     --denoise 0 \
 *     --slug "my-project-dither"
 *
 * Constitutional: AGENTS.md Key Rule 10 — manifest required before any ComfyUI job.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

const COMFYUI_URL       = process.env.COMFYUI_URL       ?? 'http://127.0.0.1:8188';
const JOB_LOG_ROOT      = process.env.JOB_LOG_ROOT      ?? 'D:/Google Antigravity/Creative Liberation Engine/job-logs/comfyui';
const WORKFLOW_PATH     = process.env.WORKFLOW_PATH      ??
    'D:/Google Antigravity/Infusion Engine Brainchild/ai/comfyui/user/default/workflows/batch-vid2vid-dither.json';
const POLL_INTERVAL_MS  = 3000;

// ── CLI Args ─────────────────────────────────────────────────────────────────

function parseArgs(): {
    video: string; outputFps: number; checkpoint: string; denoise: number; slug: string;
} {
    const args = process.argv.slice(2);
    const get  = (flag: string, fallback: string) => {
        const idx = args.indexOf(flag);
        return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
    };
    return {
        video:      get('--video',       ''),
        outputFps:  parseFloat(get('--output-fps', '24')),
        checkpoint: get('--checkpoint',  'v1-5-pruned-emaonly.ckpt'),
        denoise:    parseFloat(get('--denoise',    '0')),
        slug:       get('--slug',        `job-${Date.now()}`),
    };
}

// ── Manifest ──────────────────────────────────────────────────────────────────

interface JobManifest {
    slug:         string;
    workflow:     string;
    input_video:  string;
    checkpoint:   string;
    denoise:      number;
    output_fps:   number;
    started_at:   string;
    prompt_id?:   string;
    completed_at?: string;
    duration_s?:  number;
    output_files?: string[];
    status:       'pending' | 'queued' | 'running' | 'done' | 'failed';
    error?:       string;
}

function writeManifest(dir: string, manifest: JobManifest): void {
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
}

// ── Workflow Patch ────────────────────────────────────────────────────────────

function patchWorkflow(
    workflowJson: Record<string, any>,
    params: { video: string; outputFps: number; checkpoint: string; denoise: number; slug: string }
): Record<string, any> {
    const w = JSON.parse(JSON.stringify(workflowJson)); // deep clone

    // Patch VHS_LoadVideo node (id 1)
    if (w['1']?.inputs) {
        w['1'].inputs.video = basename(params.video); // ComfyUI input dir is relative
    }

    // Patch VHS_VideoCombine node (id 2)
    if (w['2']?.inputs) {
        w['2'].inputs.frame_rate    = params.outputFps;
        w['2'].inputs.filename_prefix = params.slug;
    }

    // Patch CheckpointLoader (id 8)
    if (w['8']?.inputs) {
        w['8'].inputs.ckpt_name = params.checkpoint;
    }

    // Patch KSampler denoise (id 9) — 0 = skip img2img entirely
    if (w['9']?.inputs) {
        w['9'].inputs.denoise = params.denoise;
    }

    return w;
}

// ── ComfyUI API Helpers ───────────────────────────────────────────────────────

async function queuePrompt(workflow: Record<string, any>): Promise<string> {
    const res = await fetch(`${COMFYUI_URL}/prompt`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt: workflow, client_id: 'cle-engine' }),
    });
    if (!res.ok) throw new Error(`ComfyUI /prompt returned ${res.status}: ${await res.text()}`);
    const data = await res.json() as { prompt_id: string };
    return data.prompt_id;
}

async function getQueueStatus(): Promise<{ queue_running: any[]; queue_pending: any[] }> {
    const res = await fetch(`${COMFYUI_URL}/queue`);
    if (!res.ok) throw new Error(`ComfyUI /queue returned ${res.status}`);
    return res.json() as Promise<{ queue_running: any[]; queue_pending: any[] }>;
}

async function getHistory(promptId: string): Promise<any> {
    const res = await fetch(`${COMFYUI_URL}/history/${promptId}`);
    if (!res.ok) return null;
    const data = await res.json() as Record<string, any>;
    return data[promptId] ?? null;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const params = parseArgs();

    if (!params.video) {
        console.error('[queue_batch_job] ERROR: --video is required');
        process.exit(1);
    }

    // 1. Write job manifest to D: BEFORE touching ComfyUI (Article X key rule 10)
    const date      = new Date().toISOString().slice(0, 10);
    const jobDir    = join(JOB_LOG_ROOT, `${date}-${params.slug}`);
    mkdirSync(jobDir, { recursive: true });

    const manifest: JobManifest = {
        slug:        params.slug,
        workflow:    WORKFLOW_PATH,
        input_video: params.video,
        checkpoint:  params.checkpoint,
        denoise:     params.denoise,
        output_fps:  params.outputFps,
        started_at:  new Date().toISOString(),
        status:      'pending',
    };
    writeManifest(jobDir, manifest);
    console.log(`[queue_batch_job] 📋 Manifest written → ${jobDir}/manifest.json`);

    // 2. Load + patch workflow
    const rawWorkflow = JSON.parse(readFileSync(WORKFLOW_PATH, 'utf8'));
    const patchedWorkflow = patchWorkflow(rawWorkflow, params);

    // 3. Submit to ComfyUI
    console.log(`[queue_batch_job] 🎬 Submitting batch job to ComfyUI...`);
    console.log(`[queue_batch_job]    Video:      ${params.video}`);
    console.log(`[queue_batch_job]    FPS:        ${params.outputFps}`);
    console.log(`[queue_batch_job]    Checkpoint: ${params.checkpoint}`);
    console.log(`[queue_batch_job]    Denoise:    ${params.denoise} ${params.denoise === 0 ? '(pure image ops — no diffusion)' : '(img2img enabled)'}`);

    let promptId: string;
    try {
        promptId = await queuePrompt(patchedWorkflow);
    } catch (err: any) {
        manifest.status = 'failed';
        manifest.error  = err.message;
        writeManifest(jobDir, manifest);
        console.error(`[queue_batch_job] ❌ Failed to queue: ${err.message}`);
        process.exit(1);
    }

    manifest.status    = 'queued';
    manifest.prompt_id = promptId;
    writeManifest(jobDir, manifest);
    console.log(`[queue_batch_job] ✅ Queued — prompt_id: ${promptId}`);

    // 4. Poll until complete
    console.log(`[queue_batch_job] ⏳ Polling for completion...`);
    const startMs = Date.now();
    manifest.status = 'running';
    writeManifest(jobDir, manifest);

    while (true) {
        await sleep(POLL_INTERVAL_MS);

        const history = await getHistory(promptId);
        if (history?.status?.completed) {
            const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

            // Collect output file paths from history outputs
            const outputFiles: string[] = [];
            for (const nodeId of Object.keys(history.outputs ?? {})) {
                const nodeOutputs = history.outputs[nodeId];
                for (const category of Object.values(nodeOutputs) as any[]) {
                    if (Array.isArray(category)) {
                        for (const item of category) {
                            if (item.filename) outputFiles.push(item.filename);
                        }
                    }
                }
            }

            manifest.status        = 'done';
            manifest.completed_at  = new Date().toISOString();
            manifest.duration_s    = parseFloat(elapsed);
            manifest.output_files  = outputFiles;
            writeManifest(jobDir, manifest);

            console.log(`[queue_batch_job] 🏁 Complete in ${elapsed}s`);
            console.log(`[queue_batch_job] 📁 Outputs: ${outputFiles.join(', ') || '(check ComfyUI output dir)'}`);
            console.log(`[queue_batch_job] 📋 Manifest updated → ${jobDir}/manifest.json`);
            break;
        }

        // Check queue to confirm still running
        const queue = await getQueueStatus();
        const inQueue = [...queue.queue_running, ...queue.queue_pending]
            .some((item: any) => item?.[1] === promptId || item?.prompt_id === promptId);

        if (!inQueue && !history?.status?.completed) {
            // Not in queue and no completed history — likely errored or evicted
            const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
            manifest.status       = 'failed';
            manifest.completed_at = new Date().toISOString();
            manifest.duration_s   = parseFloat(elapsed);
            manifest.error        = 'Job disappeared from queue without completing';
            writeManifest(jobDir, manifest);
            console.error(`[queue_batch_job] ❌ Job lost from queue after ${elapsed}s`);
            process.exit(1);
        }

        const elapsed = ((Date.now() - startMs) / 1000).toFixed(0);
        process.stdout.write(`\r[queue_batch_job] ⏱️  ${elapsed}s elapsed...`);
    }
}

main().catch(err => {
    console.error('[queue_batch_job] Fatal:', err);
    process.exit(1);
});
