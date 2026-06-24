import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ScoredClip } from './scene-scorer.js';
import { TimelineClip } from './edl-generator.js';

export interface ReelSpec {
  targetDurationSec: number;   // 20-30
  minClips: number;             // 15
  maxClips: number;             // 20
  clipTrimSec: number;          // how many seconds to take from each clip (1.5-2.5)
  fadeDurationSec: number;      // cross-fade between clips
  outputWidth: number;
  outputHeight: number;
}

export const DEFAULT_REEL_SPEC: ReelSpec = {
  targetDurationSec: 25,
  minClips: 15,
  maxClips: 20,
  clipTrimSec: 1.8,
  fadeDurationSec: 0.3,
  outputWidth: 1080,
  outputHeight: 1920,
};

export interface AssemblyResult {
  reelPath: string;
  timeline: TimelineClip[];
  totalDurationSec: number;
}

// ── Pick the best window inside a clip for maximum energy ────────────────────

function pickBestWindow(durationSec: number, windowSec: number): number {
  // Avoid the very beginning (camera settling) and very end (camera stop jitter)
  const safeStart = Math.min(2.0, durationSec * 0.1);
  const safeEnd   = Math.max(0, durationSec - windowSec - 1.5);
  if (safeEnd <= safeStart) return 0;
  // Bias toward the middle-ish area of the clip for peak action
  return safeStart + (safeEnd - safeStart) * 0.4;
}

// ── Pre-process a single clip: crop 9:16, trim, fade in/out ─────────────────

function processClip(
  sourcePath: string,
  outputPath: string,
  startSec: number,
  durationSec: number,
  spec: ReelSpec,
  addFadeIn = false,
  addFadeOut = false
): void {
  const fadeDur = spec.fadeDurationSec;
  
  // Build vf filter chain
  const filters: string[] = [
    // Scale to fill 9:16 (crop wider side)
    `scale=${spec.outputWidth}:${spec.outputHeight}:force_original_aspect_ratio=increase`,
    // Crop to exact 9:16
    `crop=${spec.outputWidth}:${spec.outputHeight}`,
  ];
  
  if (addFadeIn)  filters.push(`fade=t=in:st=0:d=${fadeDur}`);
  if (addFadeOut) filters.push(`fade=t=out:st=${(durationSec - fadeDur).toFixed(3)}:d=${fadeDur}`);

  const vfStr = filters.join(',');
  
  const cmd = [
    'ffmpeg',
    `-ss ${startSec.toFixed(3)}`,
    `-i "${sourcePath}"`,
    `-t ${durationSec.toFixed(3)}`,
    `-vf "${vfStr}"`,
    `-c:v libx264 -preset fast -crf 20`,
    `-c:a aac -ar 44100 -ac 2`,
    `-r 30`,
    `-y "${outputPath}"`,
  ].join(' ');

  execSync(cmd, { timeout: 60000, stdio: 'pipe' });
}

// ── Build concat manifest and merge all segments ─────────────────────────────

function concatSegments(segmentPaths: string[], outputPath: string, tmpDir: string): void {
  const listFile = path.join(tmpDir, 'concat_list.txt');
  const listContent = segmentPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(listFile, listContent, 'utf-8');

  const cmd = [
    'ffmpeg',
    `-f concat -safe 0`,
    `-i "${listFile}"`,
    `-c:v libx264 -preset fast -crf 20`,
    `-c:a aac`,
    `-movflags +faststart`,
    `-y "${outputPath}"`,
  ].join(' ');

  execSync(cmd, { timeout: 300000, stdio: 'pipe' });
}

// ── Add title card overlay ────────────────────────────────────────────────────

function addTitleCard(inputPath: string, outputPath: string, title: string, durationSec: number): void {
  const escapedTitle = title.replace(/'/g, "\\'").replace(/"/g, '\\"');
  
  // White text centered, visible for first 3s, fades out
  const drawtext = [
    `fontsize=64`,
    `fontcolor=white`,
    `fontfile=/Windows/Fonts/arialbd.ttf`,
    `text='${escapedTitle}'`,
    `x=(w-text_w)/2`,
    `y=(h-text_h)/2`,
    `enable='between(t,0,3)'`,
    `alpha='if(lt(t,2),1,max(0,1-(t-2)))'`,
    `box=1:boxcolor=black@0.5:boxborderw=20`,
  ].join(':');

  const cmd = [
    'ffmpeg',
    `-i "${inputPath}"`,
    `-vf "drawtext=${drawtext}"`,
    `-c:v libx264 -preset fast -crf 20`,
    `-c:a copy`,
    `-y "${outputPath}"`,
  ].join(' ');

  try {
    execSync(cmd, { timeout: 120000, stdio: 'pipe' });
  } catch {
    // If drawtext fails (font not found etc.), just copy without title card
    console.warn('[assembler] drawtext failed — skipping title card overlay');
    fs.copyFileSync(inputPath, outputPath);
  }
}

// ── Main assembly function ────────────────────────────────────────────────────

export function assembleReel(
  scoredClips: ScoredClip[],
  outputDir: string,
  eventSlug: string,
  spec: ReelSpec = DEFAULT_REEL_SPEC
): AssemblyResult {
  const tmpDir = path.join(outputDir, '_segments');
  fs.mkdirSync(tmpDir, { recursive: true });

  // Select top clips — take up to maxClips, ensure at least minClips if available
  const selected = scoredClips.slice(0, spec.maxClips);
  console.log(`[assembler] Selected ${selected.length} clips for reel`);

  // Calculate clip trim to hit target duration
  const clipCount = selected.length;
  const overlapTime = (clipCount - 1) * spec.fadeDurationSec;
  const availableTime = spec.targetDurationSec + overlapTime;
  const clipTrim = Math.min(spec.clipTrimSec, availableTime / clipCount);
  
  console.log(`[assembler] Clip trim: ${clipTrim.toFixed(2)}s × ${clipCount} clips → target ~${spec.targetDurationSec}s`);

  const timeline: TimelineClip[] = [];
  const segmentPaths: string[] = [];

  selected.forEach((clip, i) => {
    const startSec = pickBestWindow(clip.durationSeconds, clipTrim);
    const endSec   = startSec + clipTrim;
    const segPath  = path.join(tmpDir, `seg_${String(i).padStart(3, '0')}.mp4`);

    console.log(`[assembler] Processing ${clip.filename} [${startSec.toFixed(1)}s → ${endSec.toFixed(1)}s]`);
    
    processClip(
      clip.absolutePath,
      segPath,
      startSec,
      clipTrim,
      spec,
      i === 0,
      i === selected.length - 1
    );

    timeline.push({
      filename: clip.filename,
      sourcePath: clip.absolutePath,
      trimStartSec: startSec,
      trimEndSec: endSec,
    });

    segmentPaths.push(segPath);
  });

  // Concatenate all segments
  const concatPath = path.join(tmpDir, `concat_raw.mp4`);
  console.log('[assembler] Concatenating segments...');
  concatSegments(segmentPaths, concatPath, tmpDir);

  // Add title card
  const reelPath = path.join(outputDir, `${eventSlug}_reel.mp4`);
  const reelTitle = "Krista's 50th 🎉";
  console.log('[assembler] Adding title card...');
  addTitleCard(concatPath, reelPath, reelTitle, spec.targetDurationSec);

  // Calculate actual duration
  let totalDurationSec = clipTrim * clipCount - overlapTime;

  console.log(`[assembler] ✅ Reel complete: ${reelPath} (~${totalDurationSec.toFixed(1)}s)`);

  return { reelPath, timeline, totalDurationSec };
}
