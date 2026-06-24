import express from 'express';
import pino from 'pino';
import os from 'os';

const logger = pino({ name: 'cle-ai-runtime' });
const app = express();
app.use(express.json());

const PORT = parseInt(process.env.RUNTIME_PORT || '5090');

// Determine Ollama Host from env, defaulting to the docker service name if inside compose network
let ollamaHost = process.env.OLLAMA_HOST || 'http://ollama:11434';
if (!ollamaHost.startsWith('http://') && !ollamaHost.startsWith('https://')) {
    ollamaHost = `http://${ollamaHost}`;
}

logger.info({ ollamaHost }, 'Configured Ollama connection endpoint');

// Helper to check connection to Ollama
async function checkOllamaConnection(): Promise<boolean> {
    try {
        const res = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    } catch {
        return false;
    }
}

// REST Interface 

// 1. Status: Returns system load, memory, and list of local models (both downloaded and loaded in VRAM)
app.get('/api/v1/runtime/status', async (req, res) => {
    try {
        const isOllamaOnline = await checkOllamaConnection();
        let localModels: any[] = [];
        let loadedModels: any[] = [];

        if (isOllamaOnline) {
            // Get all downloaded models
            try {
                const tagsRes = await fetch(`${ollamaHost}/api/tags`);
                if (tagsRes.ok) {
                    const data = await tagsRes.json() as any;
                    localModels = data.models || [];
                }
            } catch (e: any) {
                logger.warn({ err: e.message }, 'Failed to fetch local tags from Ollama');
            }

            // Get loaded models in VRAM
            try {
                const psRes = await fetch(`${ollamaHost}/api/ps`);
                if (psRes.ok) {
                    const data = await psRes.json() as any;
                    loadedModels = data.models || [];
                }
            } catch (e: any) {
                logger.warn({ err: e.message }, 'Failed to fetch active running models (ps) from Ollama');
            }
        }

        const systemModels = localModels.map((m: any) => {
            const loadedInfo = loadedModels.find((lm: any) => lm.model === m.model || lm.name === m.name);
            return {
                model_id: m.model || m.name,
                name: m.name,
                provider: 'ollama',
                state: loadedInfo ? 'loaded' : 'unloaded',
                size_bytes: m.size || 0,
                vram_usage_bytes: loadedInfo ? loadedInfo.size : 0,
                details: m.details || {}
            };
        });

        // Compute system metrics
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const cpuLoad = os.loadavg()[0]; // 1-minute load average

        res.json({
            runtime_id: 'cle-ai-runtime-local',
            status: isOllamaOnline ? 'online' : 'offline',
            ollama_connected: isOllamaOnline,
            system_metrics: {
                cpu_load: parseFloat(cpuLoad.toFixed(2)),
                ram_total_bytes: totalMem,
                ram_used_bytes: totalMem - freeMem,
                vram_used_bytes: loadedModels.reduce((acc, m) => acc + (m.size || 0), 0)
            },
            models: systemModels
        });
    } catch (error: any) {
        logger.error({ err: error.message }, 'Failed to compile runtime status');
        res.status(500).json({ error: 'Internal runtime error', details: error.message });
    }
});

// 2. Load: Warm up model so it resides in VRAM
app.post('/api/v1/runtime/models/:modelId/load', async (req, res) => {
    const { modelId } = req.params;
    logger.info({ modelId }, 'Request received to load model into VRAM');

    try {
        // In Ollama, sending a request to /api/generate with a template and no prompt (or empty prompt)
        // loads the model. We can also send keep_alive to keep it loaded (e.g. 300s / 5m).
        const response = await fetch(`${ollamaHost}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelId,
                prompt: '',
                keep_alive: '10m' // keep loaded for 10 minutes
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Ollama load failed: ${errText}`);
        }

        logger.info({ modelId }, 'Model successfully loaded/warmed up in Ollama');
        res.json({ model_id: modelId, status: 'loaded', keep_alive: '10m' });
    } catch (error: any) {
        logger.error({ modelId, err: error.message }, 'Failed to load model');
        res.status(500).json({ error: 'Failed to load model', details: error.message });
    }
});

// 3. Unload: Free VRAM by unloading model
app.post('/api/v1/runtime/models/:modelId/unload', async (req, res) => {
    const { modelId } = req.params;
    logger.info({ modelId }, 'Request received to unload model from VRAM');

    try {
        // Sending keep_alive: 0 unloads the model from Ollama immediately
        const response = await fetch(`${ollamaHost}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelId,
                keep_alive: 0
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Ollama unload failed: ${errText}`);
        }

        logger.info({ modelId }, 'Model successfully unloaded from Ollama');
        res.json({ model_id: modelId, status: 'unloaded' });
    } catch (error: any) {
        logger.error({ modelId, err: error.message }, 'Failed to unload model');
        res.status(500).json({ error: 'Failed to unload model', details: error.message });
    }
});

// 4. Pull: Trigger download of a model
app.post('/api/v1/runtime/models/pull', async (req, res) => {
    const { model } = req.body;
    if (!model) {
        return res.status(400).json({ error: 'Missing model parameter in request body' });
    }

    logger.info({ model }, 'Triggering pull request for model');
    try {
        // Trigger non-blocking pull on Ollama (by default we don't await the entire stream here to avoid timeout)
        const response = await fetch(`${ollamaHost}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, name: model })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Ollama pull failed: ${errText}`);
        }

        res.json({ model, status: 'pulling_initiated' });
    } catch (error: any) {
        logger.error({ model, err: error.message }, 'Failed to initiate model pull');
        res.status(500).json({ error: 'Failed to pull model', details: error.message });
    }
});

// 5. Health check
app.get('/api/v1/runtime/health', async (req, res) => {
    const isOllamaOnline = await checkOllamaConnection();
    res.json({
        status: isOllamaOnline ? 'operational' : 'degraded',
        service: 'cle-ai-runtime',
        version: '1.0.0',
        ollama_status: isOllamaOnline ? 'connected' : 'disconnected'
    });
});

app.listen(PORT, () => {
    logger.info({ port: PORT }, 'CLE AI Runtime service online');
});
