import express from 'express';
import pino from 'pino';

const logger = pino({ name: 'video-agency' });
const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || '5103');
const RESOLVE_BRIDGE_URL = process.env.RESOLVE_BRIDGE_URL || 'http://127.0.0.1:5105';

logger.info({ RESOLVE_BRIDGE_URL }, 'Configured DaVinci Resolve Bridge endpoint');

// Helper function to forward request to Windows Resolve Bridge
async function forwardToBridge(path: string, body: any): Promise<{ status: number; data: any }> {
    try {
        const res = await fetch(`${RESOLVE_BRIDGE_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000) // 15s timeout
        });
        
        const data = await res.json();
        return { status: res.status, data };
    } catch (err: any) {
        logger.error({ path, err: err.message }, 'Failed to communicate with DaVinci Resolve Bridge');
        return {
            status: 502,
            data: { error: 'Failed to contact DaVinci Resolve Bridge on workstation', details: err.message }
        };
    }
}

// 1. Audio Transcription Control
app.post('/api/v1/video/transcribe', async (req, res) => {
    logger.info('Forwarding transcribe command');
    const { status, data } = await forwardToBridge('/transcribe', req.body);
    res.status(status).json(data);
});

// 2. Audio Classification Control
app.post('/api/v1/video/classify-audio', async (req, res) => {
    logger.info('Forwarding classify-audio command');
    const { status, data } = await forwardToBridge('/classify-audio', req.body);
    res.status(status).json(data);
});

// 3. Deblur Motion Correction Control
app.post('/api/v1/video/deblur', async (req, res) => {
    logger.info('Forwarding deblur command');
    const { status, data } = await forwardToBridge('/deblur', req.body);
    res.status(status).json(data);
});

// 4. Intellisearch Analysis Control
app.post('/api/v1/video/intellisearch', async (req, res) => {
    logger.info('Forwarding intellisearch command');
    const { status, data } = await forwardToBridge('/intellisearch', req.body);
    res.status(status).json(data);
});

// 5. Slate Marker Sync Control
app.post('/api/v1/video/slate-sync', async (req, res) => {
    logger.info('Forwarding slate-sync command');
    const { status, data } = await forwardToBridge('/slate-sync', req.body);
    res.status(status).json(data);
});

// 6. Speech Generation Control
app.post('/api/v1/video/generate-speech', async (req, res) => {
    logger.info('Forwarding generate-speech command');
    const { status, data } = await forwardToBridge('/generate-speech', req.body);
    res.status(status).json(data);
});

// 7. Timeline Auto-Assembly Control (Beat cut alignment, LUTs, overlays)
app.post('/api/v1/video/assemble-timeline', async (req, res) => {
    logger.info('Forwarding assemble-timeline command');
    const { status, data } = await forwardToBridge('/assemble-timeline', req.body);
    res.status(status).json(data);
});

// 8. Custom Python Script Execution inside Resolve context
app.post('/api/v1/video/execute', async (req, res) => {
    logger.info('Forwarding execute command');
    const { status, data } = await forwardToBridge('/execute', req.body);
    res.status(status).json(data);
});

// Health check
app.get('/health', async (req, res) => {
    try {
        const bridgeRes = await fetch(`${RESOLVE_BRIDGE_URL}/health`, { signal: AbortSignal.timeout(2000) });
        const bridgeData = bridgeRes.ok ? await bridgeRes.json() : null;
        res.json({
            status: bridgeRes.ok ? 'healthy' : 'degraded',
            service: 'video-agency',
            bridge_status: bridgeRes.ok ? 'connected' : 'disconnected',
            resolve_info: bridgeData
        });
    } catch {
        res.json({
            status: 'degraded',
            service: 'video-agency',
            bridge_status: 'disconnected',
            resolve_info: null
        });
    }
});

app.listen(PORT, () => {
    logger.info({ port: PORT }, 'video-agency listening on port ' + PORT);
});
