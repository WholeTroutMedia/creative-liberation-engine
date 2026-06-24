/**
 * scheduler.ts — Krista's 50th B-day Event Scheduler
 * 
 * Runs on the Windows workstation. Fires at 10:30pm EDT automatically.
 * No human input required.
 * 
 * Usage: npx tsx src/scheduler.ts
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ── Event config ──────────────────────────────────────────────────────────────

const EVENT_DATE    = '2026-03-21';
const INGEST_START  = { hour: 14, minute: 30 }; // 2:30pm EDT = 14:30 local (EDT = UTC-4)
const INGEST_END    = { hour: 22, minute: 30 }; // 10:30pm EDT

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowEdt(): Date {
  // Return current time as a Date object — TZ is set to America/New_York
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function msUntil(hour: number, minute: number): number {
  const now = nowEdt();
  const target = new Date(nowEdt());
  target.setHours(hour, minute, 0, 0);
  
  let ms = target.getTime() - now.getTime();
  if (ms < 0) ms = 0; // already past — run immediately
  return ms;
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

// ── Actions ───────────────────────────────────────────────────────────────────

function onIngestOpen(): void {
  console.log(`[scheduler] ✅ 2:30pm EDT — Ingest window is OPEN`);
  console.log(`[scheduler] FTP: 127.0.0.1:21 — Sony A1 II should connect automatically`);
  console.log(`[scheduler] Watcher: sony-ingest-watcher container monitoring /ingest/incoming`);
  console.log(`[scheduler] Gravity well: context anchor covers 2:30pm–10:30pm EDT`);
  console.log(`[scheduler] Auto-close fires at 10:30pm EDT. No action needed.`);

  // Confirm containers are up
  try {
    const running = execSync(
      `docker ps --format "{{.Names}} {{.Status}}" | findstr "sony"`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    console.log(`[scheduler] Container status:\n${running.trim()}`);
  } catch {
    console.warn('[scheduler] ⚠️  Could not verify Docker containers — ensure NAS is reachable');
  }
}

function onIngestClose(): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[scheduler] 🛑 10:30pm EDT — CLOSING INGEST WINDOW`);
  console.log(`${'='.repeat(60)}\n`);

  // Step 1: Stop the watcher container gracefully
  console.log('[scheduler] Stopping sony-ingest-watcher...');
  try {
    execSync('docker stop sony-ingest-watcher', { timeout: 30000, stdio: 'pipe' });
    console.log('[scheduler] Container stopped.');
  } catch {
    console.warn('[scheduler] Container stop failed or already stopped (non-fatal)');
  }

  // Step 2: Fire the post-processor
  console.log('[scheduler] Launching post-processor pipeline...');
  const scriptDir = __dirname;
  const postProcessorPath = path.join(scriptDir, 'post-processor.ts');

  const proc = spawn(
    'npx',
    ['tsx', postProcessorPath],
    {
      cwd: path.resolve(scriptDir, '..'),
      stdio: 'inherit',
      shell: true,
      env: { ...process.env },
    }
  );

  proc.on('close', (code) => {
    if (code === 0) {
      console.log('[scheduler] ✅ Post-processor finished successfully');
    } else {
      console.error(`[scheduler] ❌ Post-processor exited with code ${code}`);
    }
    process.exit(code ?? 0);
  });

  proc.on('error', (err) => {
    console.error('[scheduler] Post-processor spawn error:', err);
    process.exit(1);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

const now = nowEdt();
console.log(`\n${'='.repeat(60)}`);
console.log(`[scheduler] 🎬 Krista's 50th Event Scheduler`);
console.log(`[scheduler] Current time (EDT): ${now.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
console.log(`${'='.repeat(60)}\n`);

// Validate we're running on the right day
const today = now.toISOString().split('T')[0];
if (today !== EVENT_DATE) {
  console.warn(`[scheduler] ⚠️  Today is ${today}, event date is ${EVENT_DATE}. Running anyway — timers will fire relative to today.`);
}

const msToOpen  = msUntil(INGEST_START.hour, INGEST_START.minute);
const msToClose = msUntil(INGEST_END.hour, INGEST_END.minute);

if (msToOpen > 0) {
  console.log(`[scheduler] ⏰ Ingest opens in ${formatMs(msToOpen)} (2:30pm EDT)`);
  setTimeout(onIngestOpen, msToOpen);
} else {
  console.log(`[scheduler] ✅ Ingest window already open`);
  onIngestOpen();
}

if (msToClose > 0) {
  console.log(`[scheduler] ⏰ Auto-close fires in ${formatMs(msToClose)} (10:30pm EDT)`);
  setTimeout(onIngestClose, msToClose);
} else {
  console.log(`[scheduler] ⚠️  Close time has already passed — running post-processor immediately`);
  onIngestClose();
}

console.log(`\n[scheduler] Process will stay alive until 10:30pm. Do not close this terminal.`);
