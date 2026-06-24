import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { exec } from 'child_process';
import util from 'util';
import sqlite3 from 'sqlite3';

const execPromise = util.promisify(exec);

// Configuration from environment variables with defaults
const DROPZONE_DIR = process.env.DROPZONE_DIR || '/app/dropzone';
const PHOTOS_VAULT = process.env.PHOTOS_VAULT || '/app/vault/Photos';
const VIDEOS_VAULT = process.env.VIDEOS_VAULT || '/app/vault/Videos';
const RAW_VAULT = process.env.RAW_VAULT || '/app/vault/RAW Backups';
const LUT_PATH = process.env.LUT_PATH || '/app/presets/Lightroom_To_Resolve_Complete.cube';
const LEDGER_DB = process.env.LEDGER_DB || '/app/registry/media_ledger.sqlite';
const DISPATCH_URL = process.env.DISPATCH_URL || 'http://127.0.0.1:5160';

console.log(`[INGESTION-MESH] Initializing Automated Media Ingestion Mesh...`);
console.log(`[INGESTION-MESH] Configured Directories:`);
console.log(`  - Dropzone:     ${DROPZONE_DIR}`);
console.log(`  - Photos Vault: ${PHOTOS_VAULT}`);
console.log(`  - Videos Vault: ${VIDEOS_VAULT}`);
console.log(`  - RAW Vault:    ${RAW_VAULT}`);
console.log(`  - LUT Path:     ${LUT_PATH}`);
console.log(`  - Ledger DB:    ${LEDGER_DB}`);
console.log(`  - Dispatch URL: ${DISPATCH_URL}`);

// Ensure directories exist
[DROPZONE_DIR, PHOTOS_VAULT, VIDEOS_VAULT, RAW_VAULT, path.dirname(LEDGER_DB)].forEach(dir => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.warn(`[INGESTION-MESH] Warning: Could not create directory ${dir}: ${e.message}`);
    }
  }
});

// Initialize SQLite Ledger
let db;
try {
  db = new sqlite3.Database(LEDGER_DB);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS media_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      type TEXT NOT NULL,
      original_path TEXT NOT NULL,
      dest_path TEXT NOT NULL,
      staged_path TEXT,
      ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
} catch (e) {
  console.error(`[INGESTION-MESH] Failed to initialize SQLite ledger:`, e.message);
}

// Workstation task queueing debouncing map and helper
const webhookTimers = new Map();
function queueWorkstationWebhook(ingestPath, projectName) {
  if (webhookTimers.has(projectName)) {
    clearTimeout(webhookTimers.get(projectName));
  }

  const timer = setTimeout(async () => {
    webhookTimers.delete(projectName);
    console.log(`[INGESTION-MESH] Queueing Resolve project task for: ${projectName}...`);
    try {
      const response = await fetch(`${DISPATCH_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `RESOLVE_INGEST — ${projectName}`,
          description: JSON.stringify({ ingest_path: ingestPath }),
          workstream: 'media-ingest',
          status: 'queued',
          priority: 'P1',
          created_by: 'ingestion-mesh'
        })
      });
      const data = await response.json();
      console.log(`[INGESTION-MESH] Task created:`, data.task ? data.task.id : data);
    } catch (err) {
      console.error(`[INGESTION-MESH] Failed to queue Resolve task for ${projectName}:`, err.message);
    }
  }, 5000); // 5s debounce window for media batch transfers

  webhookTimers.set(projectName, timer);
}

// Watcher for media files
const usePolling = process.env.USE_POLLING === 'true' || true;
const watcher = chokidar.watch(DROPZONE_DIR, {
  persistent: true,
  usePolling: usePolling,
  interval: 2000,
  awaitWriteFinish: {
    stabilityThreshold: 5000,
    pollInterval: 1000
  }
});

watcher.on('add', (filePath) => handleNewMedia(filePath));

// Helper function to safely move files across devices (e.g. volume1 vs volume2)
async function moveFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  try {
    fs.renameSync(src, dest);
  } catch (err) {
    if (err.code === 'EXDEV') {
      // Cross-device link error, copy and unlink instead
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
    } else {
      throw err;
    }
  }
}

async function handleNewMedia(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath);

  // Ignore hidden files and directories
  if (filename.startsWith('.') || fs.statSync(filePath).isDirectory()) {
    return;
  }

  const isRawPhoto = ['.arw', '.cr3', '.nef', '.dng'].includes(ext);
  const isVideo = ['.mp4', '.mov', '.mxf', '.mkv'].includes(ext);

  if (!isRawPhoto && !isVideo) {
    return; // Ignore other files
  }

  console.log(`[INGESTION-MESH] Discovered incoming file: ${filename}`);

  try {
    // Get file modification time for date-based folder organization
    const stats = fs.statSync(filePath);
    const mtime = stats.mtime;
    const year = mtime.getFullYear().toString();
    const month = String(mtime.getMonth() + 1).padStart(2, '0');
    const day = String(mtime.getDate()).padStart(2, '0');
    const yyyymmdd = `${year}${month}${day}`;

    if (isRawPhoto) {
      const destRawDir = path.join(RAW_VAULT, year, `${yyyymmdd}_Ingest`, 'RAW');
      const destRawPath = path.join(destRawDir, filename);

      const destStagedDir = path.join(PHOTOS_VAULT, year, `${month}_${yyyymmdd}_Ingest`);
      const baseNameWithoutExt = path.basename(filename, ext);
      const destStagedPath = path.join(destStagedDir, `${baseNameWithoutExt}.jpg`);

      console.log(`[INGESTION-MESH] Routing RAW Photo: ${filename} -> ${destRawPath}`);
      await moveFile(filePath, destRawPath);

      // Create matching XMP sidecar in the RAW vault next to the RAW file
      const refXmpPath = path.join(path.dirname(LUT_PATH), 'IMG_8089_xmp.xml');
      const destXmpPath = path.join(destRawDir, `${baseNameWithoutExt}.xmp`);
      if (fs.existsSync(refXmpPath)) {
        console.log(`[INGESTION-MESH] Creating XMP sidecar: ${destXmpPath}`);
        try {
          fs.copyFileSync(refXmpPath, destXmpPath);
        } catch (xmpErr) {
          console.error(`[INGESTION-MESH] Failed to copy XMP sidecar:`, xmpErr.message);
        }
      } else {
        console.warn(`[INGESTION-MESH] Warning: Reference XMP file not found at: ${refXmpPath}`);
      }

      console.log(`[INGESTION-MESH] Developing look-applied JPEG: ${destStagedPath}`);
      // Execute the python look engine to extract and apply the LUT
      const cmd = `python3 /app/look_engine.py "${destRawPath}" "${destStagedPath}" "${LUT_PATH}"`;
      try {
        const { stdout, stderr } = await execPromise(cmd);
        if (stdout) console.log(`[look-engine stdout] ${stdout.trim()}`);
        if (stderr) console.error(`[look-engine stderr] ${stderr.trim()}`);
      } catch (execErr) {
        console.error(`[INGESTION-MESH] Look Engine failed for ${filename}:`, execErr.message);
      }

      // Record to ledger
      if (db) {
        const stmt = db.prepare("INSERT INTO media_ledger (filename, type, original_path, dest_path, staged_path) VALUES (?, ?, ?, ?, ?)");
        stmt.run(filename, 'photo', filePath, destRawPath, destStagedPath);
        stmt.finalize();
      }
    } else if (isVideo) {
      const destProxyDir = path.join(VIDEOS_VAULT, year, `${yyyymmdd}_Ingest`, 'Proxies');
      const destProxyPath = path.join(destProxyDir, filename);
      const destResolveDir = path.join(VIDEOS_VAULT, year, `${yyyymmdd}_Ingest`, 'Resolve');

      console.log(`[INGESTION-MESH] Routing Video Proxy: ${filename} -> ${destProxyPath}`);
      await moveFile(filePath, destProxyPath);

      console.log(`[INGESTION-MESH] Ensuring Resolve Workspace exists: ${destResolveDir}`);
      if (!fs.existsSync(destResolveDir)) {
        fs.mkdirSync(destResolveDir, { recursive: true });
      }

      // Record to ledger
      if (db) {
        const stmt = db.prepare("INSERT INTO media_ledger (filename, type, original_path, dest_path) VALUES (?, ?, ?, ?)");
        stmt.run(filename, 'video', filePath, destProxyPath);
        stmt.finalize();
      }

      // Trigger debounced workstation webhook for Resolve project creation
      const destIngestDir = path.join(VIDEOS_VAULT, year, `${yyyymmdd}_Ingest`);
      const projectName = `${yyyymmdd}_Ingest`;
      queueWorkstationWebhook(destIngestDir, projectName);
    }

    console.log(`[INGESTION-MESH] Successfully processed: ${filename}`);
  } catch (err) {
    console.error(`[INGESTION-MESH] Error processing ${filename}:`, err);
  }
}

// Keep process alive
setInterval(() => {}, 1000 * 60 * 60);
