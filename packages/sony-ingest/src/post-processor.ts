import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { scoreClips } from './scene-scorer.js';
import { assembleReel, DEFAULT_REEL_SPEC } from './reel-assembler.js';
import { generateEDL, generateProjectManifest } from './edl-generator.js';
import { deliverReel } from './email-delivery.js';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ── Config ────────────────────────────────────────────────────────────────────

const EVENT_SLUG = '2026-03-21_Kristas-50th-Bday-Woodway-CC';
const EVENT_LABEL = "Krista's 50th Birthday — Woodway Country Club";

// NAS accessible from Windows via SMB — W:\ = \\127.0.0.1\ personal share
const NAS_INGEST_BASE = process.env.NAS_INGEST_PATH
  || 'W:\\RAW Backups\\2026\\Barnstorm\\live-ingest';

const TRIAGE_DIR     = path.join(NAS_INGEST_BASE, 'triage', EVENT_SLUG);
const PROXIES_DIR    = path.join(TRIAGE_DIR, 'proxies');
const OUTPUT_DIR     = path.join(TRIAGE_DIR, 'output');
const THUMBS_DIR     = path.join(TRIAGE_DIR, '_thumbs');

const DRY_RUN = process.argv.includes('--dry-run');

// ── Helpers ───────────────────────────────────────────────────────────────────

function findVideos(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    console.warn(`[post-processor] Proxies dir not found: ${dir}`);
    return [];
  }
  const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mxf']);
  return fs
    .readdirSync(dir)
    .filter(f => VIDEO_EXTS.has(path.extname(f).toLowerCase()))
    .map(f => path.join(dir, f))
    .sort(); // chronological by filename (Sony naming: C0001.MP4, C0002.MP4...)
}

function flushHoldingPen(): void {
  try {
    const { execSync } = require('child_process');
    // Signal the sony-ingest-watcher container to run a final sweep
    // We do this by writing a sentinel file, then waiting for the sweep
    execSync(
      `docker exec sony-ingest-watcher sh -c "kill -USR1 1 2>/dev/null || true"`,
      { timeout: 5000, stdio: 'pipe' }
    );
    console.log('[post-processor] Final holding pen flush signalled');
  } catch {
    console.warn('[post-processor] Could not signal container flush (non-fatal)');
  }
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[post-processor] 🎬 Starting pipeline for: ${EVENT_LABEL}`);
  console.log(`[post-processor] Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EDT`);
  console.log(`[post-processor] Dry run: ${DRY_RUN}`);
  console.log(`${'='.repeat(60)}\n`);

  // 1. Flush any remaining files from holding pen
  flushHoldingPen();
  await new Promise(r => setTimeout(r, 3000)); // give watcher 3s to complete final sweep

  // 2. Find all proxy videos in triage folder
  const videoPaths = findVideos(PROXIES_DIR);
  console.log(`[post-processor] Found ${videoPaths.length} video(s) in triage`);

  if (videoPaths.length === 0) {
    console.error('[post-processor] ❌ No video files found. Check FTP delivery and gravity well config.');
    console.log(`[post-processor] Expected: ${PROXIES_DIR}`);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('\n[post-processor] DRY RUN — would score and assemble:');
    videoPaths.forEach((v, i) => console.log(`  ${i + 1}. ${path.basename(v)}`));
    console.log('[post-processor] DRY RUN complete — no files written');
    return;
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 3. Score clips
  console.log('\n[post-processor] Step 1: Scoring clips...');
  const scored = await scoreClips(videoPaths, THUMBS_DIR);
  console.log(`[post-processor] Scored ${scored.length} clips. Top picks:`);
  scored.slice(0, 5).forEach((c, i) =>
    console.log(`  ${i + 1}. ${c.filename} (score: ${c.totalScore})`)
  );

  // 4. Assemble reel
  console.log('\n[post-processor] Step 2: Assembling reel...');
  const { reelPath, timeline, totalDurationSec } = assembleReel(
    scored,
    OUTPUT_DIR,
    EVENT_SLUG,
    DEFAULT_REEL_SPEC
  );

  // 5. Generate EDL
  console.log('\n[post-processor] Step 3: Generating EDL...');
  const edlPath = path.join(OUTPUT_DIR, `${EVENT_SLUG}.edl`);
  generateEDL(timeline, EVENT_LABEL, edlPath);

  // 6. Generate project manifest
  const manifestPath = path.join(OUTPUT_DIR, 'project-manifest.json');
  generateProjectManifest({
    eventSlug: EVENT_SLUG,
    eventLabel: EVENT_LABEL,
    generatedAt: new Date().toISOString(),
    totalDurationSec,
    clipCount: timeline.length,
    clips: timeline,
    reelPath,
    edlPath,
  }, manifestPath);

  // 7. Email delivery
  console.log('\n[post-processor] Step 4: Sending email...');
  await deliverReel({
    eventSlug: EVENT_SLUG,
    eventLabel: EVENT_LABEL,
    reelPath,
    edlPath,
    manifestPath,
    clipCount: timeline.length,
    durationSec: totalDurationSec,
    nasProjectPath: OUTPUT_DIR,
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log('[post-processor] ✅ PIPELINE COMPLETE');
  console.log(`  Reel:     ${reelPath}`);
  console.log(`  EDL:      ${edlPath}`);
  console.log(`  Manifest: ${manifestPath}`);
  console.log(`  Duration: ${totalDurationSec.toFixed(1)}s`);
  console.log(`${'='.repeat(60)}\n`);
}

run().catch(err => {
  console.error('[post-processor] ❌ Fatal error:', err);
  process.exit(1);
});
