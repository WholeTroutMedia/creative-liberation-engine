/**
 * Hunyuan 3D Bridge — Tencent Cloud AI 3D Asset Generator
 *
 * Calls the Tencent Hunyuan 3D API (v3.0) to generate a 3D asset from
 * a text prompt or reference image. Returns a local GLB or FBX file path
 * ready to inject into Cinema 4D via the C4D OSC bridge.
 *
 * Hunyuan 3D 3.0 capabilities (Sep 2025):
 *   - Text/image → 3D model
 *   - 1536³ geometric resolution
 *   - 3× accuracy vs v2
 *   - UV-complete output (GLB or FBX)
 *
 * If TENCENT_CLOUD_API_KEY is not set, returns offline status with null path.
 *
 * See: https://cloud.tencent.com/product/hunyuan3d
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const HUNYUAN_API_KEY = process.env.TENCENT_CLOUD_API_KEY;
const HUNYUAN_SECRET_KEY = process.env.TENCENT_CLOUD_SECRET_KEY;
const HUNYUAN_ENDPOINT = process.env.HUNYUAN_3D_ENDPOINT || 'https://hunyuan.tencentcloudapi.com';
const HUNYUAN_REGION = process.env.TENCENT_CLOUD_REGION || 'ap-guangzhou';
const ASSET_OUTPUT_DIR = process.env.HUNYUAN_ASSET_DIR || 'D:\\Google Antigravity\\Infusion Engine Brainchild\\creative-liberation-engine-v5\\media-pipeline\\assets';
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 60; // 3 minutes max

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const Hunyuan3DInputSchema = z.object({
    prompt: z.string().describe('Text description of the 3D asset to generate'),
    referenceImageUrl: z.string().optional().describe('Optional reference image URL for style guidance'),
    sessionId: z.string().describe('Pipeline session identifier'),
    format: z.enum(['glb', 'fbx']).default('fbx').describe('Output format — FBX for C4D, GLB for UE5'),
    quality: z.enum(['draft', 'standard', 'high']).default('standard').describe('Geometric resolution tier'),
});

export const Hunyuan3DOutputSchema = z.object({
    assetPath: z.string().nullable().describe('Local path to generated asset, or null if offline/error'),
    status: z.enum(['success', 'offline', 'error', 'timeout']),
    jobId: z.string().nullable().describe('Tencent job ID for tracking'),
    qualityFlags: z.array(z.string()).describe('Asset quality notes from API (UV coverage, poly density, etc.)'),
    message: z.string(),
    generationMs: z.number().optional().describe('Total generation time in milliseconds'),
});

export type Hunyuan3DInput = z.infer<typeof Hunyuan3DInputSchema>;
export type Hunyuan3DOutput = z.infer<typeof Hunyuan3DOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate HMAC-SHA256 signature for Tencent Cloud API v3 authentication.
 * See: https://cloud.tencent.com/document/api/1729/101685
 */
async function buildTencentAuthHeader(
    service: string,
    action: string,
    payload: string,
    secretId: string,
    secretKey: string
): Promise<Record<string, string>> {
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];
    const host = `${service}.tencentcloudapi.com`;

    // Canonical request
    const canonicalHeaders = `content-type:application/json\nhost:${host}\n`;
    const signedHeaders = 'content-type;host';
    const payloadHash = await sha256Hex(payload);
    const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

    // String to sign
    const credentialScope = `${date}/${service}/tc3_request`;
    const stringToSign = ['TC3-HMAC-SHA256', timestamp.toString(), credentialScope, await sha256Hex(canonicalRequest)].join('\n');

    // Signature
    const secretDate = await hmacSha256(`TC3${secretKey}`, date);
    const secretService = await hmacSha256Buffer(secretDate, service);
    const secretSigning = await hmacSha256Buffer(secretService, 'tc3_request');
    const signature = await hmacSha256Hex(secretSigning, stringToSign);

    const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
        'Authorization': authorization,
        'Content-Type': 'application/json',
        'Host': host,
        'X-TC-Action': action,
        'X-TC-Timestamp': timestamp.toString(),
        'X-TC-Version': '2023-09-01',
        'X-TC-Region': HUNYUAN_REGION,
    };
}

// Crypto helpers using Node.js built-in crypto
import { createHmac, createHash } from 'crypto';

function sha256Hex(data: string): string {
    return createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmacSha256(key: string, data: string): Buffer {
    return createHmac('sha256', key).update(data, 'utf8').digest();
}

function hmacSha256Buffer(key: Buffer, data: string): Buffer {
    return createHmac('sha256', key).update(data, 'utf8').digest();
}

function hmacSha256Hex(key: Buffer, data: string): string {
    return createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

interface HunyuanJobResponse {
    Response: {
        JobId?: string;
        Status?: string;
        DownloadUrl?: string;
        Error?: { Code: string; Message: string };
        RequestId: string;
    };
}

async function submitHunyuan3DJob(
    prompt: string,
    format: 'glb' | 'fbx',
    quality: string,
    referenceImageUrl?: string
): Promise<string> {
    const payload = JSON.stringify({
        Prompt: prompt,
        Format: format.toUpperCase(),
        QualityLevel: quality === 'high' ? 2 : quality === 'standard' ? 1 : 0,
        ...(referenceImageUrl ? { ReferenceImageUrl: referenceImageUrl } : {}),
    });

    const headers = await buildTencentAuthHeader(
        'hunyuan3d', 'SubmitHunyuan3DJob', payload,
        HUNYUAN_API_KEY!, HUNYUAN_SECRET_KEY!
    );

    const resp = await fetch(`${HUNYUAN_ENDPOINT}/`, {
        method: 'POST',
        headers,
        body: payload,
    });

    const json = await resp.json() as HunyuanJobResponse;

    if (json.Response.Error) {
        throw new Error(`Hunyuan API error: ${json.Response.Error.Code} — ${json.Response.Error.Message}`);
    }

    return json.Response.JobId!;
}

async function pollHunyuan3DJob(jobId: string): Promise<{ downloadUrl: string; qualityFlags: string[] }> {
    const payload = JSON.stringify({ JobId: jobId });

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        const headers = await buildTencentAuthHeader(
            'hunyuan3d', 'QueryHunyuan3DJob', payload,
            HUNYUAN_API_KEY!, HUNYUAN_SECRET_KEY!
        );

        const resp = await fetch(`${HUNYUAN_ENDPOINT}/`, {
            method: 'POST',
            headers,
            body: payload,
        });

        const json = await resp.json() as HunyuanJobResponse;

        if (json.Response.Error) {
            throw new Error(`Hunyuan poll error: ${json.Response.Error.Code}`);
        }

        const status = json.Response.Status;
        console.log(`[HY3D] Job ${jobId} — attempt ${attempt + 1}/${POLL_MAX_ATTEMPTS} — status: ${status}`);

        if (status === 'Completed' && json.Response.DownloadUrl) {
            return {
                downloadUrl: json.Response.DownloadUrl,
                qualityFlags: [], // API may return quality metadata; extend here
            };
        }

        if (status === 'Failed') {
            throw new Error('Hunyuan3D job failed on server');
        }

        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }

    throw new Error(`Hunyuan3D job ${jobId} timed out after ${POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

async function downloadAsset(downloadUrl: string, outputPath: string): Promise<void> {
    const resp = await fetch(downloadUrl);
    if (!resp.ok) throw new Error(`Asset download failed: ${resp.status}`);
    const buffer = await resp.arrayBuffer();
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(buffer));
}

// ─────────────────────────────────────────────────────────────────────────────
// GENKIT FLOW
// ─────────────────────────────────────────────────────────────────────────────

export const Hunyuan3DBridgeFlow = ai.defineFlow(
    {
        name: 'Hunyuan3DBridge',
        inputSchema: Hunyuan3DInputSchema,
        outputSchema: Hunyuan3DOutputSchema,
    },
    async (input: Hunyuan3DInput): Promise<Hunyuan3DOutput> => {
        console.log(`[HY3D] Hunyuan 3D Bridge — prompt: "${input.prompt.slice(0, 60)}..." format: ${input.format}`);

        // Offline mode — return gracefully if API keys not set
        if (!HUNYUAN_API_KEY || !HUNYUAN_SECRET_KEY) {
            console.warn('[HY3D] ⚠️  TENCENT_CLOUD_API_KEY not set — returning offline status');
            return {
                assetPath: null,
                status: 'offline',
                jobId: null,
                qualityFlags: [],
                message: 'Hunyuan 3D offline: set TENCENT_CLOUD_API_KEY and TENCENT_CLOUD_SECRET_KEY in .env to enable AI 3D generation',
            };
        }

        const startMs = Date.now();

        try {
            // Step 1: Submit generation job
            console.log('[HY3D] Submitting generation job to Tencent Cloud...');
            const jobId = await submitHunyuan3DJob(
                input.prompt,
                input.format,
                input.quality,
                input.referenceImageUrl
            );
            console.log(`[HY3D] Job submitted: ${jobId}`);

            // Step 2: Poll until complete
            const { downloadUrl, qualityFlags } = await pollHunyuan3DJob(jobId);

            // Step 3: Download asset to local media-pipeline/assets/
            const filename = `hy3d_${input.sessionId}_${jobId.slice(-8)}.${input.format}`;
            const outputPath = path.join(ASSET_OUTPUT_DIR, filename);
            console.log(`[HY3D] Downloading asset → ${outputPath}`);
            await downloadAsset(downloadUrl, outputPath);

            const generationMs = Date.now() - startMs;
            console.log(`[HY3D] ✅ Asset ready in ${(generationMs / 1000).toFixed(1)}s: ${outputPath}`);

            return {
                assetPath: outputPath,
                status: 'success',
                jobId,
                qualityFlags,
                message: `Generated ${input.format.toUpperCase()} asset in ${(generationMs / 1000).toFixed(1)}s`,
                generationMs,
            };

        } catch (e) {
            const msg = `Hunyuan 3D generation failed: ${e}`;
            console.error(`[HY3D] ❌ ${msg}`);
            return {
                assetPath: null,
                status: (e as Error).message.includes('timed out') ? 'timeout' : 'error',
                jobId: null,
                qualityFlags: [],
                message: msg,
            };
        }
    }
);
