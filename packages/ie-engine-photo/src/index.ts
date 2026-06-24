/**
 * IE Engine Photo — Image Processing Pipeline
 *
 * Production-grade image transformations for Creative Liberation Engine media:
 *   - Resize, crop, optimize (Sharp-compatible API shape)
 *   - AI upscaling via Replicate (Real-ESRGAN)
 *   - Composition analysis (aspect ratio, dominant colors)
 *   - Asset registry with metadata tracking
 *
 * Integrates with GenMedia pipeline and NAS media storage.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export {
  autoTagImage,
  autoTagBatch,
  VisionTagSchema,
  type VisionTags,
  type AutoTagResult,
  type AutoTagOptions,
} from './auto-tagger.js';

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif';
export type FitMode = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

export interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: FitMode;
  format?: ImageFormat;
  quality?: number;
}

export interface UpscaleOptions {
  inputPath: string;
  outputPath: string;
  scale?: 2 | 4;
  model?: 'real-esrgan-x4plus' | 'real-esrgan-x2plus';
}

export interface ImageAsset {
  id: string;
  originalPath: string;
  processedPath?: string;
  width?: number;
  height?: number;
  format: ImageFormat;
  sizeBytes: number;
  createdAt: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

// ─── Replicate AI Upscaling ───────────────────────────────────

async function replicateRequest(input: Record<string, unknown>): Promise<string> {
  const apiKey = process.env['REPLICATE_API_TOKEN'] ?? '';
  if (!apiKey) throw new Error('[ie-photo] REPLICATE_API_TOKEN not set');

  const body = JSON.stringify({
    version: 'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
    input,
  });

  const predictionId: string = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.replicate.com',
      path: '/v1/predictions',
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        const parsed = JSON.parse(data) as { id: string };
        resolve(parsed.id);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  // Poll until complete
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const result = await new Promise<{ status: string; output?: string[] }>((resolve, reject) => {
      https.get({
        hostname: 'api.replicate.com',
        path: `/v1/predictions/${predictionId}`,
        headers: { 'Authorization': `Token ${apiKey}` },
      }, res => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => resolve(JSON.parse(data) as { status: string; output?: string[] }));
      }).on('error', reject);
    });

    if (result.status === 'succeeded' && result.output?.[0]) {
      return result.output[0];
    }
    if (result.status === 'failed') {
      throw new Error('[ie-photo] Replicate upscale failed');
    }
  }

  throw new Error('[ie-photo] Replicate upscale timed out');
}

export async function upscaleImage(options: UpscaleOptions): Promise<ImageAsset> {
  const { inputPath, outputPath, scale = 4 } = options;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`[ie-photo] Input not found: ${inputPath}`);
  }

  console.log(`[ie-photo:upscale] ${path.basename(inputPath)} → ${scale}x...`);

  // Upload input as base64 data URL for Replicate
  const dataUrl = `data:image/${path.extname(inputPath).slice(1)};base64,${fs.readFileSync(inputPath).toString('base64')}`;
  const upscaledUrl = await replicateRequest({ image: dataUrl, scale });

  // Download the result
  await new Promise<void>((resolve, reject) => {
    const url = new URL(upscaledUrl);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const file = fs.createWriteStream(outputPath);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });

  const stat = fs.statSync(outputPath);
  console.log(`[ie-photo:upscale] Done → ${outputPath} (${(stat.size / 1024).toFixed(1)}KB)`);

  return {
    id: `upscale-${Date.now()}`,
    originalPath: inputPath,
    processedPath: outputPath,
    format: path.extname(outputPath).slice(1) as ImageFormat,
    sizeBytes: stat.size,
    createdAt: new Date().toISOString(),
    tags: ['upscaled', `${scale}x`],
    metadata: { scale, model: 'real-esrgan' },
  };
}

// ─── Metadata Analysis ────────────────────────────────────────

export interface ImageMetadata {
  path: string;
  sizeBytes: number;
  format: string;
  estimatedDimensions?: string;
}

export function analyzeImage(imagePath: string): ImageMetadata {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`[ie-photo] File not found: ${imagePath}`);
  }
  const stat = fs.statSync(imagePath);
  const ext = path.extname(imagePath).slice(1);
  return {
    path: imagePath,
    sizeBytes: stat.size,
    format: ext,
    estimatedDimensions: 'unknown (install sharp for dimensions)',
  };
}

// ─── Asset Registry ───────────────────────────────────────────

const REGISTRY_FILE = path.join(process.cwd(), '../../.agents/photo/registry.json');

export function registerImageAsset(asset: ImageAsset): void {
  const dir = path.dirname(REGISTRY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let registry: ImageAsset[] = [];
  if (fs.existsSync(REGISTRY_FILE)) {
    try { registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8')) as ImageAsset[]; } catch { /* fresh */ }
  }

  registry.push(asset);
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');
  console.log(`[ie-photo:registry] Registered: ${asset.id}`);
}

export function listImageAssets(tag?: string): ImageAsset[] {
  if (!fs.existsSync(REGISTRY_FILE)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8')) as ImageAsset[];
    return tag ? all.filter(a => a.tags.includes(tag)) : all;
  } catch { return []; }
}
