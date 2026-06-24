/**
 * Model fleet — proxy and health aggregation for GPU inference services on genesis-net.
 */
import type { Express, Request, Response } from 'express';

const DEFAULT_SAM3 = 'http://sam3-api:8080';
const TIMEOUT_MS = 4000;

async function probeHealth(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
    const base = url.replace(/\/$/, '');
    try {
        const r = await fetch(base, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return { ok: r.ok, status: r.status };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
    }
}

function sam3Base(): string {
    const u = process.env['CLE_SAM3_URL']?.trim();
    return (u && u.length > 0 ? u : DEFAULT_SAM3).replace(/\/$/, '');
}

export function registerModelFleetRoutes(app: Express): void {
    app.get('/api/model-fleet/status', async (_req: Request, res: Response) => {
        const sam3 = sam3Base();
        const cleUrl = (process.env['CLE_ENGINE_URL']?.trim() || 'http://cle-engine:8000').replace(
            /\/$/,
            '',
        );
        const spatialStatus =
            process.env['SPATIAL_HTTP_STATUS_URL']?.trim() ||
            'http://spatial-intelligence:5200/eon-reality/status';
        const tritonReady =
            process.env['TRITON_HEALTH_URL']?.trim() ||
            `${(process.env['TRITON_HTTP_URL']?.trim() || 'http://triton-server:8000').replace(/\/$/, '')}/v2/health/ready`;

        const rows = await Promise.all([
            probeHealth(`${cleUrl}/`).then((r) => ({
                service: 'cle-engine',
                url: cleUrl,
                ...r,
            })),
            probeHealth(`${sam3}/health`).then((r) => ({ service: 'sam3-api', url: sam3, ...r })),
            probeHealth(`${(process.env['VISION_FORGE_URL']?.trim() || 'http://vision-forge:9001').replace(/\/$/, '')}/health`).then(
                (r) => ({
                    service: 'vision-forge',
                    url: process.env['VISION_FORGE_URL'] || 'http://vision-forge:9001',
                    ...r,
                }),
            ),
            probeHealth(
                `${(process.env['TRIPOSR_URL']?.trim() || 'http://triposr-api:9002').replace(/\/$/, '')}/health`,
            ).then((r) => ({
                service: 'triposr-api',
                url: process.env['TRIPOSR_URL'] || 'http://triposr-api:9002',
                ...r,
            })),
            probeHealth(
                `${(process.env['FOLEY_ENGINE_URL']?.trim() || 'http://foley-engine:9003').replace(/\/$/, '')}/health`,
            ).then((r) => ({
                service: 'foley-engine',
                url: process.env['FOLEY_ENGINE_URL'] || 'http://foley-engine:9003',
                ...r,
            })),
            probeHealth(tritonReady).then((r) => ({
                service: 'triton-server',
                url: tritonReady,
                ...r,
            })),
            probeHealth(`${(process.env['VLLM_OPENAI_URL']?.trim() || 'http://vllm:8000').replace(/\/$/, '')}/health`).then(
                (r) => ({
                    service: 'vllm',
                    url: process.env['VLLM_OPENAI_URL'] || 'http://vllm:8000',
                    ...r,
                }),
            ),
            probeHealth(spatialStatus).then((r) => ({
                service: 'spatial-intelligence',
                url: spatialStatus,
                note: 'EON webhook HTTP; gRPC on :50051',
                ...r,
            })),
        ]);

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: rows,
        });
    });

    app.post('/api/model-fleet/segment', async (req: Request, res: Response) => {
        const body = req.body as { image_b64?: string; prompt?: string };
        if (!body?.image_b64 || typeof body.image_b64 !== 'string') {
            res.status(400).json({ error: 'image_b64 is required' });
            return;
        }
        const prompt = typeof body.prompt === 'string' && body.prompt.length > 0 ? body.prompt : 'object';
        const base = sam3Base();
        try {
            const r = await fetch(`${base}/v1/segment/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_b64: body.image_b64, prompt }),
                signal: AbortSignal.timeout(120_000),
            });
            const text = await r.text();
            if (!r.ok) {
                res.status(r.status).type('application/json').send(text);
                return;
            }
            res.type('application/json').send(text);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(503).json({ error: 'sam3_proxy_failed', detail: msg, attempted: base });
        }
    });
}
