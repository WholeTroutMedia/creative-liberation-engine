import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import chokidar from 'chokidar';
import axios from 'axios';
import pino from 'pino';
import { exec } from 'child_process';
import { promisify } from 'util';

// Feature Imports
import { AestheticTagger, AestheticMetrics } from './features/aesthetic-tagger.js';
import { FaceSceneTagger } from './features/face-scene-tagger.js';
import { ProxyBuilder } from './features/proxy-builder.js';
import { SyncManager } from './features/sync-manager.js';
import { LocalHudServer } from './features/local-hud-server.js';
import { ModelReloader } from './features/model-reloader.js';
import { SensorIntegrator } from './features/sensor-integrator.js';
import { TimecodeSync } from './features/timecode-sync.js';
import { EdlGenerator, EdlEvent } from './features/edl-generator.js';
import { CameraScanner } from './features/camera-scanner.js';
import { OscTransmitter } from './features/osc-transmitter.js';
import { FusionExporter, TrackingPoint } from './features/fusion-exporter.js';
import { ModelRegistry } from './features/model-registry.js';

const execPromise = promisify(exec);
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// Load .env configuration
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    for (const line of envConfig.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = (match[2] || '').trim();
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    }
  }
} catch (err: any) {
  logger.warn(`Failed to parse .env file: ${err.message}`);
}

// Environment Constants
const NODE_ID = process.env.NODE_ID || 'ALPON_X5_001';
const DROPZONE_DIR = process.env.DROPZONE_DIR || '/opt/camera-ingest/dropzone';
const PROCESSED_DIR = path.join(DROPZONE_DIR, 'processed');
const CACHE_DIR = path.join(DROPZONE_DIR, 'cache');
const DISPATCH_URL = process.env.DISPATCH_URL || 'http://127.0.0.1:5160';
const HUD_PORT = parseInt(process.env.HUD_PORT || '8080', 10);
const STORAGE_POOL = process.env.STORAGE_POOL || 'NAS_PRIMARY';
const STABILITY_INTERVAL = 2000;

// NAS SSH Credentials
const NAS_SSH_HOST = process.env.NAS_SSH_HOST || '127.0.0.1';
const NAS_SSH_PORT = process.env.NAS_SSH_PORT || '2000';
const NAS_SSH_USER = process.env.NAS_SSH_USER || 'jaharoni';
const NAS_SSH_KEY = process.env.NAS_SSH_KEY || '/home/alpon/.ssh/id_ed25519';
const NAS_INGESTION_DIR = process.env.NAS_INGESTION_DIR || '/app/creative-liberation-engine/runtime/ingestion/dropzone';

// Ensure Directories Exist
[DROPZONE_DIR, PROCESSED_DIR, CACHE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Initialize Native Edge Capabilities Suite
const modelRegistry = new ModelRegistry();
const aestheticTagger = new AestheticTagger();
const faceSceneTagger = new FaceSceneTagger();
const proxyBuilder = new ProxyBuilder();
const syncManager = new SyncManager(CACHE_DIR, DISPATCH_URL);
const hudServer = new LocalHudServer(DROPZONE_DIR, HUD_PORT, modelRegistry);
const modelReloader = new ModelReloader();
const sensorIntegrator = new SensorIntegrator();
const timecodeSync = new TimecodeSync();
const edlGenerator = new EdlGenerator();
const cameraScanner = new CameraScanner();
const oscTransmitter = new OscTransmitter();
const fusionExporter = new FusionExporter();

// Memory list of active events to generate EDL files
const activeEdlEvents: EdlEvent[] = [];

// Start Local HUD Web Gallery & Search API
hudServer.start();

// Heartbeat Loop (Registers edge node status with central mesh orchestrator)
async function sendHeartbeat() {
  const profile = syncManager.getProfile();
  const payload = {
    agent_id: "camera_ingest",
    window: "edge-alpon-x5",
    workstream: "camera-ingest",
    tool: "alpon-edge",
    current_task: "monitoring dropzone",
    status: profile === 'OFFLINE' ? 'degraded' : 'healthy',
    network_profile: profile,
    timestamp: new Date().toISOString()
  };

  try {
    await axios.post(`${DISPATCH_URL}/api/agents/heartbeat`, payload, { timeout: 2000 });
  } catch (err: any) {
    logger.debug(`[CAMERA_INGEST] Heartbeat error: ${err.message}`);
  }
}

// Network and Sync scheduler loop (Runs every 15s)
async function runNetworkScheduler() {
  await syncManager.detectNetworkProfile();
  await syncManager.flushOfflineQueue();
  sendHeartbeat();
}
setInterval(runNetworkScheduler, 15000);
runNetworkScheduler();

// Camera scanner loop (Runs every 60s)
setInterval(async () => {
  if (syncManager.getProfile() !== 'OFFLINE') {
    await cameraScanner.scanSubnet();
  }
}, 60000);

// Helper to compute file checksum
function computeChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

// Helper to watch for file writes completing
function waitForFileSizeStability(filePath: string, interval: number): Promise<void> {
  return new Promise((resolve) => {
    let lastSize = -1;
    const check = () => {
      if (!fs.existsSync(filePath)) return;
      const stats = fs.statSync(filePath);
      if (stats.size === lastSize && stats.size > 0) {
        resolve();
      } else {
        lastSize = stats.size;
        setTimeout(check, interval);
      }
    };
    check();
  });
}

// Subprocess calling Python NPU wrapper (Model Agnostic version)
async function runEdgeAIInference(filePath: string): Promise<{
  tags: string[];
  sharpness: number;
  contrast: number;
  brightness: number;
  detections: any;
}> {
  const activeModel = modelRegistry.getActiveModel();
  const pythonBin = '/opt/sixfab-dx/venv/bin/python';
  const scriptPath = '/opt/camera-ingest/src/inference.py';
  
  // Pass model file path and task type to the python runner
  const cmd = `"${pythonBin}" "${scriptPath}" "${filePath}" "${activeModel.path}" "${activeModel.type}"`;

  logger.info(`[CAMERA_INGEST] Running NPU inference on active brain [${activeModel.name}]: ${cmd}`);
  try {
    const { stdout } = await execPromise(cmd);
    const parsed = JSON.parse(stdout.trim());
    if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
      return {
        tags: parsed.tags || [],
        sharpness: parsed.metrics?.sharpness || 150.0,
        contrast: parsed.metrics?.contrast || 50.0,
        brightness: parsed.metrics?.brightness || 120.0,
        detections: parsed.detections || []
      };
    }
  } catch (err: any) {
    logger.warn(`[CAMERA_INGEST] NPU inference fallback: ${err.message}`);
  }

  // General fallback values if NPU runtime has issue
  return {
    tags: ['inference_fallback'],
    sharpness: 120.0,
    contrast: 45.0,
    brightness: 110.0,
    detections: []
  };
}

// Command execution helper for Synology NAS transfer
async function replicateToNAS(localPath: string, filename: string): Promise<void> {
  const targetDir = NAS_INGESTION_DIR.endsWith('/') ? NAS_INGESTION_DIR : `${NAS_INGESTION_DIR}/`;
  const cmd = `scp -O -P ${NAS_SSH_PORT} -o StrictHostKeyChecking=no -i ${NAS_SSH_KEY} "${localPath}" ${NAS_SSH_USER}@${NAS_SSH_HOST}:${targetDir}${filename}`;

  logger.info(`[CAMERA_INGEST] Copying file to NAS: ${cmd}`);
  try {
    await execPromise(cmd);
    logger.info(`[CAMERA_INGEST] Transferred ${filename} successfully to NAS.`);
  } catch (err: any) {
    logger.error(`[CAMERA_INGEST] NAS Copy failed: ${err.message}`);
    throw err;
  }
}

// Ingestion Handler
async function handleNewFile(filePath: string) {
  const filename = path.basename(filePath);
  if (filePath.includes('processed') || filePath.includes('cache')) return;

  const ext = path.extname(filePath).toLowerCase();
  const allowed = ['.arw', '.cr3', '.nef', '.dng', '.jpg', '.jpeg', '.mp4', '.mov'];
  if (!allowed.includes(ext)) return;

  logger.info(`[CAMERA_INGEST] Starting ingestion: ${filename}`);

  try {
    // 1. Wait for file write to complete
    await waitForFileSizeStability(filePath, STABILITY_INTERVAL);
    logger.info(`[CAMERA_INGEST] File write stabilized: ${filename}`);

    // 2. Compute Checksum
    const checksum = await computeChecksum(filePath);

    // 3. Environmental Sensor Ingestion (Sensor Fusion)
    const environmentalContext = sensorIntegrator.readSensors();

    // 4. Run Edge NPU AI Inference (YOLO / classification + coordinates)
    const inferenceResult = await runEdgeAIInference(filePath);

    // 5. Transmit OSC tracking coordinates live (dynamic formats)
    const activeModel = modelRegistry.getActiveModel();
    oscTransmitter.transmit(activeModel.type, inferenceResult.detections);

    // 6. Generate Resolve Fusion Tracker CSV (Only for standard object detection)
    if (activeModel.type === 'object_detection') {
      const trackingPoints: TrackingPoint[] = (inferenceResult.detections || []).map((det: any, index: number) => ({
        frame: index,
        x: det.x,
        y: det.y,
        width: det.width,
        height: det.height
      }));
      fusionExporter.writeTrackerFile(trackingPoints, PROCESSED_DIR, filename.split('.')[0]);
    }

    // 7. Aesthetic Quality Tagging
    const aestheticMetrics: AestheticMetrics = {
      sharpness: inferenceResult.sharpness,
      contrast: inferenceResult.contrast,
      brightness: inferenceResult.brightness
    };
    const aestheticResult = aestheticTagger.analyze(aestheticMetrics);

    // 8. Face/Scene classification mapping
    const faceSceneResult = faceSceneTagger.catalog(inferenceResult.tags);

    // 9. Timecode Extraction
    const syncReport = await timecodeSync.extractTimecode(filePath);

    // Compile combined tags
    const combinedTags = Array.from(new Set([
      ...inferenceResult.tags,
      ...aestheticResult.tags,
      ...faceSceneResult.tags,
      `timecode:${syncReport.timecode.replace(/:/g, '_')}`,
      `model:${activeModel.id}`
    ]));

    // 10. Generate Local Proxies (transcode videos or extract raw JPEG previews)
    let finalPath = filePath;
    let isProxy = false;
    let proxyPath = '';

    if (['.arw', '.cr3', '.nef', '.dng'].includes(ext)) {
      // Photo RAW -> Extract Preview JPEG and apply LUT
      const extracted = await proxyBuilder.extractRawPreview(filePath, PROCESSED_DIR);
      if (extracted) {
        proxyPath = await proxyBuilder.applyLUT(extracted, 'camera_standard.cube', `${extracted}_graded.jpg`);
      }
    } else if (['.mp4', '.mov'].includes(ext)) {
      // Video highres -> transcode proxy clip via FFmpeg
      const outProxy = path.join(PROCESSED_DIR, `${path.basename(filePath, ext)}_proxy.mp4`);
      try {
        proxyPath = await proxyBuilder.transcodeVideoProxy(filePath, outProxy);
        isProxy = true;
      } catch (err: any) {
        logger.error(`[CAMERA_INGEST] Video proxy transcoding failed: ${err.message}`);
      }
    }

    // 11. Append to EDL / XML events registry
    activeEdlEvents.push({
      filename: filename,
      reelName: 'REEL_001',
      timecodeIn: syncReport.timecode,
      timecodeOut: '01:00:10:00', // Mocking 10s default duration if frame count isn't read
      timelineIn: '00:00:00:00',
      timelineOut: '00:00:10:00'
    });
    // Write out updated EDL and XML timeline project files to processed folder
    edlGenerator.writeTimelineFiles(activeEdlEvents, PROCESSED_DIR, 'set_sync_timeline');

    // 12. Local external USB mirror backup
    await syncManager.mirrorToUSBDrive(DROPZONE_DIR);

    // 13. Move ingested file to processed archive
    const targetPath = path.join(PROCESSED_DIR, filename);
    fs.renameSync(filePath, targetPath);
    logFileMetadata(targetPath, combinedTags, checksum, environmentalContext, syncReport);

    // 14. P2P Local Mesh Sharing Broadcast
    syncManager.broadcastP2PFile(filename, targetPath);

    // 15. Evaluate upload routing based on active Network Profile
    const isSelected = combinedTags.includes('selected') || !aestheticResult.isLowQuality;
    const shouldSync = syncManager.shouldSyncFile(filename, isProxy || proxyPath !== '', isSelected);

    const metaRecord = {
      logical_id: `asset:photos:edge:${filename.split('.')[0]}`,
      physical_path: targetPath,
      pool: STORAGE_POOL,
      source_device: NODE_ID,
      checksum_sha256: checksum,
      tags: combinedTags,
      environmental: environmentalContext,
      sync: syncReport,
      ingest_timestamp: new Date().toISOString()
    };

    if (shouldSync) {
      // Replicate main or proxy file to NAS (non-blocking background thread)
      const uploadTarget = proxyPath !== '' ? proxyPath : targetPath;
      replicateToNAS(uploadTarget, path.basename(uploadTarget)).catch(err => {
        logger.error(`[CAMERA_INGEST] Background NAS replication failed: ${err.message}`);
      });

      // Notify dispatch mesh
      try {
        await axios.post(`${DISPATCH_URL}/api/tasks`, {
          title: `EDGE INGEST — ${filename}`,
          description: JSON.stringify(metaRecord, null, 2),
          workstream: "media-ingest",
          assigned_to: "orchestrator",
          priority: "P2",
          created_by: "camera_ingest"
        }, { timeout: 3000 });
      } catch (err: any) {
        logger.debug(`[CAMERA_INGEST] Sync complete, dispatch unavailable. Caching event.`);
        await syncManager.cacheEventLocally(metaRecord);
      }
    } else {
      logger.info(`[CAMERA_INGEST] File saved locally, skipped NAS replication under sync profile constraints.`);
      // Cache event locally for future sync
      await syncManager.cacheEventLocally(metaRecord);
    }

  } catch (err: any) {
    logger.error(`[CAMERA_INGEST] Error processing file ${filename}: ${err.message}`);
  }
}

// Writes companion metadata sidecar JSON
function logFileMetadata(filePath: string, tags: string[], checksum: string, env: any, sync: any) {
  const metaPath = `${filePath}.json`;
  const meta = {
    file: path.basename(filePath),
    checksum_sha256: checksum,
    tags: tags,
    environmental: env,
    sync: sync,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

// Watch Dropzone Directory
const watcher = chokidar.watch(DROPZONE_DIR, {
  persistent: true,
  ignoreInitial: true,
  depth: 0
});

watcher.on('add', filePath => handleNewFile(filePath));
logger.info(`[CAMERA_INGEST] Monitoring started on: ${DROPZONE_DIR}`);

// Keep process active
setInterval(() => {}, 1000 * 60 * 60);

// Graceful Shutdown
process.on('SIGTERM', () => {
  syncManager.shutdown();
  hudServer.shutdown();
  oscTransmitter.shutdown();
  process.exit(0);
});
