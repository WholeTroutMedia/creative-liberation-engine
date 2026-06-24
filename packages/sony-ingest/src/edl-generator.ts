import fs from 'fs';
import path from 'path';

export interface TimelineClip {
  filename: string;
  sourcePath: string;
  trimStartSec: number;
  trimEndSec: number;
}

export interface ProjectManifest {
  eventSlug: string;
  eventLabel: string;
  generatedAt: string;
  totalDurationSec: number;
  clipCount: number;
  clips: TimelineClip[];
  reelPath: string;
  edlPath: string;
}

// ── Timecode helpers ──────────────────────────────────────────────────────────

function toTimecode(seconds: number, fps = 29.97): string {
  const totalFrames = Math.round(seconds * fps);
  const frames = totalFrames % Math.round(fps);
  const totalSeconds = Math.floor(totalFrames / Math.round(fps));
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return [hours, mins, secs, frames].map(n => String(n).padStart(2, '0')).join(':');
}

// ── EDL Generator (CMX 3600 — DaVinci Resolve compatible) ────────────────────

export function generateEDL(
  clips: TimelineClip[],
  eventTitle: string,
  outputPath: string
): void {
  const lines: string[] = [
    `TITLE: ${eventTitle}`,
    'FCM: NON-DROP FRAME',
    '',
  ];

  let recordHead = 0;

  clips.forEach((clip, i) => {
    const eventNum = String(i + 1).padStart(3, '0');
    const srcDuration = clip.trimEndSec - clip.trimStartSec;

    const srcIn  = toTimecode(clip.trimStartSec);
    const srcOut = toTimecode(clip.trimEndSec);
    const recIn  = toTimecode(recordHead);
    const recOut = toTimecode(recordHead + srcDuration);

    lines.push(`${eventNum}  AX       V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}`);
    lines.push(`* FROM CLIP NAME:  ${clip.filename}`);
    lines.push(`* SOURCE FILE: ${clip.sourcePath}`);
    lines.push('');

    recordHead += srcDuration;
  });

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
  console.log(`[edl] Written: ${outputPath} (${clips.length} events)`);
}

// ── DaVinci Resolve Project Manifest ──────────────────────────────────────────

export function generateProjectManifest(
  manifest: ProjectManifest,
  outputPath: string
): void {
  const drInstructions = [
    'DAVINCI RESOLVE IMPORT INSTRUCTIONS',
    '====================================',
    '1. Open DaVinci Resolve → File → Import → Timeline (EDL)',
    `2. Select: ${manifest.edlPath}`,
    '3. When prompted for media locations, point to the proxies folder',
    '4. The timeline will be reconstructed with all source clips in order',
    '5. To work with full-res: Right-click clips → Relink → point to the originals',
    '',
    'FOLDER STRUCTURE',
    '----------------',
    `Event: ${manifest.eventSlug}`,
    `Generated: ${manifest.generatedAt}`,
    `Reel: ${manifest.reelPath}`,
    `EDL: ${manifest.edlPath}`,
    '',
  ];

  const jsonContent = JSON.stringify({ ...manifest, drInstructions }, null, 2);
  fs.writeFileSync(outputPath, jsonContent, 'utf-8');

  // Also write a human-readable README.txt in the same folder
  const readmePath = path.join(path.dirname(outputPath), 'README.txt');
  fs.writeFileSync(readmePath, drInstructions.join('\n'), 'utf-8');
  console.log(`[edl] Project manifest: ${outputPath}`);
  console.log(`[edl] README: ${readmePath}`);
}
