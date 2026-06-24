import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { extractCreationTime, isWithinGravityWell, TemporalData } from './temporal';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ── Config ──────────────────────────────────────────────────────────────────
const INCOMING_DIR = process.env.SONY_INGEST_INCOMING_DIR || '/app/vault/RAW Backups/2026/Barnstorm/live-ingest/incoming';
const TRIAGE_DIR = process.env.SONY_INGEST_TRIAGE_DIR || '/app/vault/RAW Backups/2026/Barnstorm/live-ingest/triage';
const UNLABELED_DIR = process.env.SONY_INGEST_UNLABELED_DIR || '/app/vault/RAW Backups/2026/Barnstorm/live-ingest/unlabeled';
const ALIGNMENT_INTERVAL_MS = 15000; // Check the holding pen every 15 seconds
const HOLDING_EXPIRY_MS = 2 * 60 * 60 * 1000; // Age out to unlabeled after 2 hours in holding

interface HoldingItem {
  filename: string;
  absolutePath: string;
  type: 'video' | 'anchor';
  discoveredAt: number;
  temporalData?: TemporalData; // For video
  anchorPayload?: any; // For JSON context
}

const holdingPen: Record<string, HoldingItem> = {};

// ── Helpers ──────────────────────────────────────────────────────────────────
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    // console.log(`[ingest] Created directory: ${dir}`);
  }
}

function generateEventSlug(baseName: string): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${dateStr}_${baseName}`;
}

// ── File Ingestion ───────────────────────────────────────────────────────────
function handleNewFile(filePath: string): void {
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase();

  if (holdingPen[filename]) return; // Already tracking

  if (['.mp4', '.mov', '.mxf', '.insv', '.insp', '.lrv'].includes(ext)) {
    console.log(`[ingest] 📹 Video proxy entered holding pen: ${filename}`);
    
    // Extract temporal metadata immediately
    const temporalData = extractCreationTime(filePath);
    
    holdingPen[filename] = {
      filename,
      absolutePath: filePath,
      type: 'video',
      discoveredAt: Date.now(),
      temporalData
    };
  } else if (ext === '.json') {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const payload = JSON.parse(raw);
      if (payload._type === 'context_payload') {
        console.log(`[ingest] ⚓ Context Anchor entered holding pen: ${payload.eventSlug || filename}`);
        holdingPen[filename] = {
          filename,
          absolutePath: filePath,
          type: 'anchor',
          discoveredAt: Date.now(),
          anchorPayload: payload
        };
      }
    } catch (err) {
      console.warn(`[ingest] Failed to parse JSON ${filename}:`, err);
    }
  }
}

function handleFileRemoved(filePath: string): void {
  const filename = path.basename(filePath);
  if (holdingPen[filename]) {
    delete holdingPen[filename];
  }
}

// ── Temporal Alignment Sweep ────────────────────────────────────────────────
function performTemporalAlignment() {
  const items = Object.values(holdingPen);
  const videos = items.filter(i => i.type === 'video');
  const anchors = items.filter(i => i.type === 'anchor');

  if (videos.length === 0 && anchors.length === 0) return;

  console.log(`[temporal-sweep] Analyzing ${videos.length} videos and ${anchors.length} context anchors...`);

  // Step 1: Process Anchors (Gravity Wells)
  for (const anchor of anchors) {
    const payload = anchor.anchorPayload;
    if (!payload?.timestampMs) continue;

    const anchorTimeMs = payload.timestampMs;
    const preWindow = payload.gravityWell?.preMinutes || 15;
    const postWindow = payload.gravityWell?.postMinutes || 30;
    
    const slug = generateEventSlug(payload.eventSlug || 'Event');
    const projectDir = path.join(TRIAGE_DIR, slug);
    const proxiesDir = path.join(projectDir, 'proxies');

    let pulledCount = 0;

    // Sweep holding pen for matching videos
    for (const video of videos) {
      // If we don't have a reliable creation time or it was already snatched, skip 
      if (!video.temporalData?.creationTimeMs) continue;
      if (!holdingPen[video.filename]) continue;

      const isMatch = isWithinGravityWell(video.temporalData.creationTimeMs, anchorTimeMs, preWindow, postWindow);
      if (isMatch) {
         ensureDir(proxiesDir);
         
         const destPath = path.join(proxiesDir, video.filename);
         try {
           fs.renameSync(video.absolutePath, destPath);
           console.log(`[gravity-well] 🧲 Pulled ${video.filename} into ${slug}`);
           pulledCount++;
           
           // Remove from holding pen 
           delete holdingPen[video.filename];
         } catch (e) {
           console.error(`[gravity-well] Failed to move ${video.filename}:`, e);
         }
      }
    }

    // Always move the anchor JSON to the project dir as well to seal the Context Window
    if (pulledCount > 0 || Date.now() - anchor.discoveredAt > HOLDING_EXPIRY_MS) {
       ensureDir(projectDir);
       const destPath = path.join(projectDir, `context_anchor_${payload.id}.json`);
       try {
         fs.renameSync(anchor.absolutePath, destPath);
         delete holdingPen[anchor.filename];
         console.log(`[gravity-well] 🏁 Sealed ${slug} with ${pulledCount} files.`);
       } catch (e) {
         console.error(`[gravity-well] Failed to move anchor ${anchor.filename}:`, e);
       }
    }
  }

  // Step 2: Age out orphaned videos (B-Roll Sweep)
  const now = Date.now();
  for (const video of videos) {
    if (holdingPen[video.filename] && (now - video.discoveredAt > HOLDING_EXPIRY_MS)) {
       ensureDir(UNLABELED_DIR);
       const destPath = path.join(UNLABELED_DIR, video.filename);
       try {
         fs.renameSync(video.absolutePath, destPath);
         console.log(`[unlabeled-sweep] 🧹 Aged out orphan to Unlabeled: ${video.filename}`);
         delete holdingPen[video.filename];
       } catch (e) {
         console.error(`[unlabeled-sweep] Failed to move ${video.filename}:`, e);
       }
    }
  }
}

// ── Watcher ──────────────────────────────────────────────────────────────────
function startWatcher(): void {
  ensureDir(INCOMING_DIR);
  ensureDir(TRIAGE_DIR);
  ensureDir(UNLABELED_DIR);

  console.log(`[ingest] 🎥 Sony/Insta360 Context Engine started`);
  console.log(`[ingest] Watching drop zone: ${INCOMING_DIR}`);

  // Chokidar looks for any new files 
  const watcher = chokidar.watch(INCOMING_DIR, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 5000, // wait 5s after last write (FTP upload settling)
      pollInterval: 1000,
    },
    depth: 0 // Only watch the root of the incoming dir
  });

  watcher.on('add', (filePath: string) => {
    handleNewFile(filePath);
  });
  
  watcher.on('unlink', (filePath: string) => {
    handleFileRemoved(filePath);
  });

  watcher.on('error', (error: Error) => {
    console.error('[ingest] Watcher error:', error);
  });

  // Start the Temporal Sweep loop
  setInterval(() => {
    performTemporalAlignment();
  }, ALIGNMENT_INTERVAL_MS);

  console.log(`[ingest] Temporal sweep loop armed (${ALIGNMENT_INTERVAL_MS}ms intervals)`);
}

startWatcher();
