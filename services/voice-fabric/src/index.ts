import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execFileAsync = promisify(execFile);
const logger = pino({ name: 'voice-fabric' });
const app = express();
app.use(express.json());

const PORT = parseInt(process.env.VOICE_PORT || '5090');
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'large-v3';
const DISPATCH_URL = process.env.DISPATCH_URL || 'http://localhost:5050';
const TMP_DIR = '/tmp/voice-fabric';

const upload = multer({ dest: TMP_DIR, limits: { fileSize: 50 * 1024 * 1024 } });

// --- Types ---
interface VoiceSession {
  session_id: string;
  created_at: string;
  mode: 'stt' | 'tts' | 'bidirectional' | 'command';
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
  transcriptions: Transcription[];
  commands_dispatched: CommandResult[];
}

interface Transcription {
  text: string;
  confidence: number;
  language_detected: string;
  duration_seconds: number;
  timestamp: string;
}

interface CommandResult {
  intent: string;
  confidence: number;
  routed_to_agent: string;
  dispatch_task_id: string;
  response_text: string;
  latency_ms: number;
}

// --- Session Store ---
const sessions = new Map<string, VoiceSession>();

// --- STT via Whisper ---
async function transcribeAudio(audioPath: string): Promise<Transcription> {
  const startTime = Date.now();
  try {
    // Use whisper CLI (expected to be installed in the container)
    const { stdout } = await execFileAsync('whisper', [
      audioPath,
      '--model', WHISPER_MODEL,
      '--output_format', 'json',
      '--output_dir', TMP_DIR,
      '--language', 'en',
    ], { timeout: 60000 });

    const jsonPath = audioPath.replace(/\.[^.]+$/, '.json');
    const result = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));
    const duration = (Date.now() - startTime) / 1000;

    return {
      text: result.text?.trim() || '',
      confidence: 0.95,
      language_detected: result.language || 'en',
      duration_seconds: duration,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    logger.error({ error: err.message }, 'Whisper transcription failed');
    return {
      text: '',
      confidence: 0,
      language_detected: 'unknown',
      duration_seconds: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

// --- Intent Detection & Agent Routing ---
async function detectIntentAndRoute(text: string): Promise<CommandResult> {
  const startTime = Date.now();

  // Route to dispatch for agent execution
  try {
    const res = await fetch(`${DISPATCH_URL}/api/v1/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'voice-fabric',
        type: 'voice_command',
        payload: { text, intent: 'auto_detect' },
      }),
    });
    const data = await res.json() as { task_id?: string; agent?: string; result?: string };
    const latency = Date.now() - startTime;

    return {
      intent: 'voice_command',
      confidence: 0.9,
      routed_to_agent: data.agent || 'dispatch',
      dispatch_task_id: data.task_id || uuidv4(),
      response_text: data.result || `Command received: "${text}"`,
      latency_ms: latency,
    };
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Dispatch routing failed, returning echo');
    return {
      intent: 'voice_command',
      confidence: 0.5,
      routed_to_agent: 'none',
      dispatch_task_id: '',
      response_text: `I heard: "${text}" but could not route to an agent.`,
      latency_ms: Date.now() - startTime,
    };
  }
}

// --- TTS (placeholder for Piper/other engine) ---
async function synthesizeSpeech(text: string): Promise<string> {
  try {
    const outputPath = path.join(TMP_DIR, `${uuidv4()}.wav`);
    // Use piper TTS if available
    await execFileAsync('piper', [
      '--model', process.env.PIPER_MODEL || '/models/en_US-amy-medium.onnx',
      '--output_file', outputPath,
    ], { timeout: 30000, input: text });
    return outputPath;
  } catch {
    logger.warn('Piper TTS not available, returning text-only response');
    return '';
  }
}

// --- Routes ---

// STT endpoint — accepts audio file upload
app.post('/api/v1/voice/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

  const sessionId = req.body.session_id || uuidv4();
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      session_id: sessionId,
      created_at: new Date().toISOString(),
      mode: 'stt',
      status: 'idle',
      transcriptions: [],
      commands_dispatched: [],
    });
  }

  const session = sessions.get(sessionId)!;
  session.status = 'processing';

  const transcription = await transcribeAudio(req.file.path);
  session.transcriptions.push(transcription);
  session.status = 'idle';

  // Clean up temp file
  await fs.unlink(req.file.path).catch(() => {});

  res.json({ session_id: sessionId, transcription });
});

// Voice command — transcribe and route to agent
app.post('/api/v1/voice/command', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

  const sessionId = req.body.session_id || uuidv4();
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      session_id: sessionId,
      created_at: new Date().toISOString(),
      mode: 'command',
      status: 'idle',
      transcriptions: [],
      commands_dispatched: [],
    });
  }

  const session = sessions.get(sessionId)!;
  session.status = 'processing';

  // STT
  const transcription = await transcribeAudio(req.file.path);
  session.transcriptions.push(transcription);

  if (!transcription.text) {
    session.status = 'idle';
    await fs.unlink(req.file.path).catch(() => {});
    return res.json({ session_id: sessionId, transcription, command: null, error: 'No speech detected' });
  }

  // Route to agent
  const command = await detectIntentAndRoute(transcription.text);
  session.commands_dispatched.push(command);

  // TTS response
  const audioResponse = await synthesizeSpeech(command.response_text);
  session.status = 'idle';

  await fs.unlink(req.file.path).catch(() => {});

  res.json({
    session_id: sessionId,
    transcription,
    command,
    response_audio: audioResponse || null,
    latency: {
      stt_ms: Math.round(transcription.duration_seconds * 1000),
      processing_ms: command.latency_ms,
      total_ms: Math.round(transcription.duration_seconds * 1000) + command.latency_ms,
    },
  });
});

// TTS endpoint
app.post('/api/v1/voice/synthesize', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });
  const audioPath = await synthesizeSpeech(text);
  if (audioPath) {
    res.sendFile(audioPath);
  } else {
    res.json({ text, audio: null, note: 'TTS engine not available, text-only response' });
  }
});

app.get('/api/v1/voice/session/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

app.get('/api/v1/voice/health', (_req, res) => {
  res.json({ status: 'operational', service: 'voice-fabric', version: '1.0.0', whisper_model: WHISPER_MODEL });
});

// --- WebSocket for streaming ---
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/api/v1/voice/stream' });

wss.on('connection', (ws: WebSocket) => {
  const sessionId = uuidv4();
  logger.info({ session_id: sessionId }, 'Voice stream connected');

  ws.on('message', async (data: Buffer) => {
    // Save audio chunk, transcribe, route
    const chunkPath = path.join(TMP_DIR, `${sessionId}_${Date.now()}.wav`);
    await fs.writeFile(chunkPath, data);
    const transcription = await transcribeAudio(chunkPath);
    if (transcription.text) {
      const command = await detectIntentAndRoute(transcription.text);
      ws.send(JSON.stringify({ transcription, command }));
    }
    await fs.unlink(chunkPath).catch(() => {});
  });

  ws.on('close', () => {
    logger.info({ session_id: sessionId }, 'Voice stream disconnected');
  });
});

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Voice Fabric service online');
});

export { transcribeAudio, detectIntentAndRoute, synthesizeSpeech };
