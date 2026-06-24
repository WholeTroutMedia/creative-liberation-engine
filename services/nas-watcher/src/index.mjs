import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';

const VAULT_2025 = '/app/vault/RAW Backups/2025';
const VAULT_2026 = '/app/vault/RAW Backups/2026';
const DISPATCH_URL = 'http://127.0.0.1:5050/api/events';

// Function to send event to Dispatch
async function notifyDispatch(filePath, eventType) {
  try {
    const payload = {
      type: 'PROXY_MEDIA_DETECTED',
      source: 'nas-watcher',
      payload: {
        filePath,
        eventType,
        timestamp: new Date().toISOString()
      }
    };
    
    const response = await fetch(DISPATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log(`[nas-watcher] ✅ Notified dispatch: ${eventType} -> ${filePath}`);
    } else {
      console.error(`[nas-watcher] ❌ Dispatch failed with status: ${response.status}`);
    }
  } catch (err) {
    console.error(`[nas-watcher] ⚠️ Could not reach dispatch: ${err.message}`);
  }
}

function handleProxyFile(filePath, eventType) {
  // Only process if it's inside a 'Proxy' directory
  if (filePath.includes('/Proxy/') || filePath.includes('\\Proxy\\')) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.mp4', '.mov', '.mxf'].includes(ext)) {
      console.log(`[nas-watcher] 🎬 Proxy File ${eventType}: ${filePath}`);
      notifyDispatch(filePath, eventType);
    }
  }
}

// 1. Initial Scan for 2025
console.log(`[nas-watcher] 🔍 Starting initial proxy scan for 2025...`);

const watcher2025 = chokidar.watch(VAULT_2025, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: false // Just scan once, don't keep running
});

watcher2025.on('add', (filePath) => handleProxyFile(filePath, 'DISCOVERED'))
  .on('ready', () => console.log('[nas-watcher] ✅ Finished scanning 2025.'));

// 2. Watch 2026 continuously (and scan existing)
console.log(`[nas-watcher] 👀 Setting up continuous watch on 2026...`);
const watcher2026 = chokidar.watch(VAULT_2026, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: false // Will trigger 'add' for existing files during initialization
});

watcher2026
  .on('add', (filePath) => handleProxyFile(filePath, 'ADDED'))
  .on('change', (filePath) => handleProxyFile(filePath, 'CHANGED'))
  .on('ready', () => console.log('[nas-watcher] 🚀 Continuous watcher ready for 2026!'));
