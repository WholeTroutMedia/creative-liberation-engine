import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { Server as OscServer } from 'node-osc';
import { readdirSync, statSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ────────────────────────────────────────────────────────────────────
const PHOTO_DIR = process.env.PHOTO_DIR || '\\\\127.0.0.1\\The Vault\\photos\\North Fork Sun';
const OSC_PORT  = parseInt(process.env.OSC_PORT  || '9000');
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3000');
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.avif']);

// ─── Build folder tree ─────────────────────────────────────────────────────────
// Returns a recursive structure: { name, path, photos: [], children: [] }
function buildTree(dirPath, relativePath = '') {
  const node = { name: path.basename(dirPath), path: relativePath, photos: [], children: [] };
  if (!existsSync(dirPath)) return node;

  let entries;
  try { entries = readdirSync(dirPath, { withFileTypes: true }); }
  catch { return node; }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, entry.name);
    const relPath  = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const child = buildTree(fullPath, relPath);
      // Only include if it has photos (directly or in children)
      if (child.photos.length > 0 || child.children.length > 0) {
        node.children.push(child);
      }
    } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      node.photos.push(`/photos/${relPath.split('\\').join('/')}`);
    }
  }

  // Sort alphabetically
  node.children.sort((a, b) => a.name.localeCompare(b.name));
  node.photos.sort();
  return node;
}

// ─── Express App ───────────────────────────────────────────────────────────────
const app        = express();
const httpServer = createServer(app);

app.use(express.static(path.join(__dirname, 'public')));

// Return full folder tree
app.get('/api/tree', (req, res) => {
  const tree = buildTree(PHOTO_DIR);
  res.json(tree);
});

// Serve photos — handle URL-encoded nested paths
app.use('/photos', (req, res, next) => {
  // remap to actual fs path under PHOTO_DIR
  const sub = decodeURIComponent(req.path).replace(/^\//, '');
  const abs  = path.join(PHOTO_DIR, sub);
  if (!abs.startsWith(PHOTO_DIR)) return res.status(403).end();
  res.sendFile(abs, err => { if (err) next(err); });
});

// ─── WebSocket ─────────────────────────────────────────────────────────────────
const wss     = new WebSocketServer({ server: httpServer });
const clients = new Set();

wss.on('connection', ws => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const c of clients) if (c.readyState === 1) c.send(msg);
}

// ─── OSC Receiver ──────────────────────────────────────────────────────────────
const oscServer = new OscServer(OSC_PORT, '0.0.0.0');

oscServer.on('message', (msg) => {
  const [address, ...args] = msg;
  const parts = address.split('/').filter(Boolean);
  if (parts[0] !== 'zigsim' || parts.length < 3) return;
  const sensor = parts[2];

  let payload = { sensor, t: Date.now() };
  switch (sensor) {
    case 'accel':   payload = { ...payload, x: args[0], y: args[1], z: args[2] }; break;
    case 'gyro':    payload = { ...payload, x: args[0], y: args[1], z: args[2] }; break;
    case 'gravity': payload = { ...payload, x: args[0], y: args[1], z: args[2] }; break;
    case 'attitude':payload = { ...payload, roll: args[0], pitch: args[1], yaw: args[2] }; break;
    case 'touch':   payload = { ...payload, index: args[0], x: args[1], y: args[2] }; break;
    case 'mic':     payload = { ...payload, level: args[0] }; break;
    case 'baro':
      const alt = Math.round(44330 * (1 - Math.pow(args[0] / 1013.25, 0.1903)));
      payload = { ...payload, pressure: args[0], altitude: alt };
      break;
    case 'gps': payload = { ...payload, lat: args[0], lon: args[1], alt: args[2], speed: args[3] }; break;
    default:    payload = { ...payload, raw: args };
  }
  broadcast(payload);
});

oscServer.on('error', err => console.error('[osc]', err.message));

// ─── Start ─────────────────────────────────────────────────────────────────────
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets))
    for (const iface of nets[name])
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
  return 'localhost';
}

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  const dir = PHOTO_DIR.length > 34 ? '...' + PHOTO_DIR.slice(-31) : PHOTO_DIR;
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        🎞️   MOTION GALLERY               ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Gallery   →  http://${ip}:${HTTP_PORT}`);
  console.log(`║  OSC port  →  UDP ${OSC_PORT} (all interfaces)`);
  console.log(`║  Photos    →  ${dir}`);
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  ZigSim → Host: ${ip}   Port: ${OSC_PORT}`);
  console.log('╚══════════════════════════════════════════╝\n');
});
