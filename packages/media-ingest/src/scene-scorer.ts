import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface ScoredClip {
  filename: string;
  absolutePath: string;
  durationSeconds: number;
  bitrateKbps: number;
  energyScore: number;
  faceScore: number;
  compositionScore: number;
  totalScore: number;
  thumbnailPaths: string[];
}

interface FfprobeFormat {
  duration?: string;
  bit_rate?: string;
  size?: string;
  tags?: Record<string, string>;
}

interface FfprobeOutput {
  format?: FfprobeFormat;
  streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
}

// ── FFprobe helpers ────────────────────────────────────────────────────────────

function probeFile(filePath: string): FfprobeOutput | null {
  try {
    const result = execSync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
      { timeout: 15000, encoding: 'utf-8' }
    );
    return JSON.parse(result) as FfprobeOutput;
  } catch {
    console.warn(`[scorer] ffprobe failed for ${filePath}`);
    return null;
  }
}

function extractThumbnails(filePath: string, durationSec: number, outputDir: string, basename: string): string[] {
  const thumbnailPaths: string[] = [];
  // Sample at 20%, 50%, 80% of the clip
  const samplePoints = [0.2, 0.5, 0.8].map(p => Math.floor(p * durationSec));
  
  for (let i = 0; i < samplePoints.length; i++) {
    const outPath = path.join(outputDir, `${basename}_thumb${i}.jpg`);
    try {
      execSync(
        `ffmpeg -ss ${samplePoints[i]} -i "${filePath}" -vframes 1 -q:v 3 "${outPath}" -y`,
        { timeout: 15000, stdio: 'pipe' }
      );
      if (fs.existsSync(outPath)) {
        thumbnailPaths.push(outPath);
      }
    } catch {
      // non-fatal
    }
  }
  return thumbnailPaths;
}

// ── Gemini Vision scoring ──────────────────────────────────────────────────────

async function scoreWithGemini(thumbnailPaths: string[]): Promise<{ energy: number; faces: number; composition: number }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || thumbnailPaths.length === 0) {
    return { energy: 5, faces: 5, composition: 5 }; // neutral fallback
  }

  try {
    // Dynamic import to keep module load fast when Gemini is unavailable
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });

    const imageParts = thumbnailPaths.map(p => ({
      inlineData: {
        mimeType: 'image/jpeg' as const,
        data: fs.readFileSync(p).toString('base64'),
      },
    }));

    const prompt = `You are scoring video frames from an event (birthday party, ~50 people, indoor venue).
Score these frames on a scale of 0-10 for each category:
- energy: Motion, dancing, action, crowd engagement (10 = high energy, 0 = static/empty)
- faces: Number of smiling, expressive faces visible (10 = many happy faces, 0 = no faces)
- composition: Framing quality, lighting, rule of thirds (10 = excellent, 0 = blurry/dark)

Respond ONLY with JSON: {"energy": X, "faces": X, "composition": X}`;

    const result = await model.generateContent([prompt, ...imageParts]);
    const text = result.response.text().trim();
    const match = text.match(/\{[^}]+\}/);
    if (match) {
      const scores = JSON.parse(match[0]);
      return {
        energy: Math.min(10, Math.max(0, Number(scores.energy) || 5)),
        faces: Math.min(10, Math.max(0, Number(scores.faces) || 5)),
        composition: Math.min(10, Math.max(0, Number(scores.composition) || 5)),
      };
    }
  } catch (err) {
    console.warn(`[scorer] Gemini Vision failed, using bitrate heuristic:`, (err as Error).message);
  }

  return { energy: 5, faces: 5, composition: 5 };
}

// ── Bitrate heuristic fallback ─────────────────────────────────────────────────

function bitrateToEnergyScore(bitrateKbps: number): number {
  // Higher bitrate = more scene complexity/motion = higher energy
  // Typical event video: 8000-40000 kbps
  const normalized = Math.min(bitrateKbps / 25000, 1.0);
  return Math.round(normalized * 10);
}

// ── Main exports ──────────────────────────────────────────────────────────────

export async function scoreClips(
  clipPaths: string[],
  thumbDir: string
): Promise<ScoredClip[]> {
  const useGemini = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  console.log(`[scorer] Scoring ${clipPaths.length} clips (Gemini Vision: ${useGemini ? 'ON' : 'OFF — bitrate heuristic'})`);

  fs.mkdirSync(thumbDir, { recursive: true });

  const scored: ScoredClip[] = [];

  for (const filePath of clipPaths) {
    const filename = path.basename(filePath);
    const basename = path.parse(filename).name;
    const probe = probeFile(filePath);

    if (!probe?.format) {
      console.warn(`[scorer] Skipping unprobeable file: ${filename}`);
      continue;
    }

    const durationSeconds = parseFloat(probe.format.duration || '0');
    const bitrateKbps = Math.round(parseInt(probe.format.bit_rate || '0') / 1000);

    if (durationSeconds < 1) {
      console.warn(`[scorer] Skipping too-short clip: ${filename} (${durationSeconds.toFixed(1)}s)`);
      continue;
    }

    const thumbnailPaths = extractThumbnails(filePath, durationSeconds, thumbDir, basename);
    
    let energyScore: number;
    let faceScore: number;
    let compositionScore: number;

    if (useGemini && thumbnailPaths.length > 0) {
      const scores = await scoreWithGemini(thumbnailPaths);
      energyScore = scores.energy;
      faceScore = scores.faces;
      compositionScore = scores.composition;
    } else {
      energyScore = bitrateToEnergyScore(bitrateKbps);
      faceScore = 5;
      compositionScore = 5;
    }

    // Weighted: energy matters most for an Instagram reel
    const totalScore = energyScore * 0.5 + faceScore * 0.3 + compositionScore * 0.2;

    scored.push({
      filename,
      absolutePath: filePath,
      durationSeconds,
      bitrateKbps,
      energyScore,
      faceScore,
      compositionScore: Math.round(compositionScore),
      totalScore: Math.round(totalScore * 10) / 10,
      thumbnailPaths,
    });

    console.log(`[scorer] ${filename}: energy=${energyScore} faces=${faceScore} comp=${compositionScore} → total=${totalScore.toFixed(1)}`);
  }

  // Sort descending by total score
  return scored.sort((a, b) => b.totalScore - a.totalScore);
}
