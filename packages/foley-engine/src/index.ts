/**
 * Foley Engine — AI Audio Synthesis Layer
 *
 * Generates, analyzes, and spatializes audio for Creative Liberation Engine
 * media productions. Two modes:
 *
 *   1. AI Generation — Replicate / ElevenLabs APIs for voice, SFX, music
 *   2. Local Pipeline — ffmpeg-based audio processing (normalize, mix, export)
 *
 * Designed to work with the DaVinci Resolve MCP and GenMedia pipeline.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { execSync } from 'child_process';

// ─── Types ───────────────────────────────────────────────────

export type AudioFormat = 'mp3' | 'wav' | 'flac' | 'ogg';
export type SFXCategory = 'ambient' | 'ui' | 'notification' | 'transition' | 'impact';

export interface TTSOptions {
  text: string;
  voice?: string;         // ElevenLabs voice ID
  model?: string;         // e.g. 'eleven_turbo_v2_5'
  outputPath: string;
  format?: AudioFormat;
}

export interface SFXOptions {
  prompt: string;
  category: SFXCategory;
  durationSeconds?: number;
  outputPath: string;
}

export interface AudioProcessOptions {
  inputPath: string;
  outputPath: string;
  normalizeDb?: number;   // target LUFS (e.g. -14 for streaming)
  trimSilence?: boolean;
  fadeInMs?: number;
  fadeOutMs?: number;
}

export interface AudioAsset {
  id: string;
  type: 'tts' | 'sfx' | 'processed';
  path: string;
  durationMs?: number;
  sizeBytes: number;
  createdAt: string;
  metadata: Record<string, unknown>;
}

// ─── ElevenLabs TTS ──────────────────────────────────────────

export async function synthesizeSpeech(options: TTSOptions): Promise<AudioAsset> {
  const { text, voice = 'pNInz6obpgDQGcFmaJgB', model = 'eleven_turbo_v2_5', outputPath, format = 'mp3' } = options;
  const apiKey = process.env['ELEVENLABS_API_KEY'] ?? '';

  if (!apiKey) {
    throw new Error('[foley] ELEVENLABS_API_KEY not set');
  }

  console.log(`[foley:tts] Synthesizing ${text.length} chars with voice ${voice}...`);

  const body = JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.8 } });

  await new Promise<void>((resolve, reject) => {
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${voice}`,
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': `audio/${format}`,
      },
    }, res => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, Buffer.concat(chunks));
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  const stat = fs.statSync(outputPath);
  console.log(`[foley:tts] Saved → ${outputPath} (${stat.size} bytes)`);

  return {
    id: `tts-${Date.now()}`,
    type: 'tts',
    path: outputPath,
    sizeBytes: stat.size,
    createdAt: new Date().toISOString(),
    metadata: { voice, model, text: text.slice(0, 80) },
  };
}

// ─── Local ffmpeg Processing ──────────────────────────────────

export function processAudio(options: AudioProcessOptions): AudioAsset {
  const { inputPath, outputPath, normalizeDb = -14, trimSilence = false, fadeInMs = 0, fadeOutMs = 0 } = options;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`[foley:process] Input file not found: ${inputPath}`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const filters: string[] = [];
  if (trimSilence) filters.push('silenceremove=start_periods=1:start_silence=0.1:start_threshold=-50dB');
  if (normalizeDb) filters.push(`loudnorm=I=${normalizeDb}:TP=-1.5:LRA=11`);
  if (fadeInMs > 0) filters.push(`afade=t=in:d=${fadeInMs / 1000}`);
  if (fadeOutMs > 0) filters.push(`afade=t=out:d=${fadeOutMs / 1000}`);

  const filterStr = filters.length > 0 ? `-af "${filters.join(',')}"` : '';
  const cmd = `ffmpeg -i "${inputPath}" ${filterStr} -y "${outputPath}" 2>&1`;

  console.log(`[foley:process] ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
  execSync(cmd, { stdio: 'pipe' });

  const stat = fs.statSync(outputPath);
  return {
    id: `proc-${Date.now()}`,
    type: 'processed',
    path: outputPath,
    sizeBytes: stat.size,
    createdAt: new Date().toISOString(),
    metadata: { normalizeDb, trimSilence, fadeInMs, fadeOutMs },
  };
}

// ─── Asset Registry ───────────────────────────────────────────

const REGISTRY_FILE = path.join(process.cwd(), '../../.agents/foley/registry.json');

export function registerAsset(asset: AudioAsset): void {
  const dir = path.dirname(REGISTRY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let registry: AudioAsset[] = [];
  if (fs.existsSync(REGISTRY_FILE)) {
    try { registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8')) as AudioAsset[]; } catch { /* fresh */ }
  }

  registry.push(asset);
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');
  console.log(`[foley:registry] Registered asset: ${asset.id}`);
}

export function listAssets(): AudioAsset[] {
  if (!fs.existsSync(REGISTRY_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8')) as AudioAsset[]; } catch { return []; }
}

export { composeVideo } from './video-pipeline.js';
export type { VideoScene, VideoPipelineOptions } from './video-pipeline.js';
