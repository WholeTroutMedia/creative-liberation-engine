import express from 'express';
import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3902;

// Runtime injections directory on NAS
const NAS_INJECTIONS_DIR = '/app/genesis-deploy/runtime/injections';

console.log(`[HMR-MESH] Initializing Runtime Logic Compilation & Injection...`);
console.log(`[HMR-MESH] Monitoring: ${NAS_INJECTIONS_DIR}`);

// Stub: ensure directory exists
if (!fs.existsSync(NAS_INJECTIONS_DIR)) {
  fs.mkdirSync(NAS_INJECTIONS_DIR, { recursive: true });
}

// In-memory cache of compiled/active logic modules
const activeModules = new Map();

// Initialize watcher
const watcher = chokidar.watch(NAS_INJECTIONS_DIR, { persistent: true });

watcher.on('add', (filePath) => reloadModule(filePath));
watcher.on('change', (filePath) => reloadModule(filePath));
watcher.on('unlink', (filePath) => activeModules.delete(filePath));

async function reloadModule(filePath) {
  if (!filePath.endsWith('.js')) return;
  console.log(`[HMR-MESH] Hot-reloading module: ${filePath}`);
  try {
    // ESM cache busting via query param
    const moduleName = path.basename(filePath, '.js');
    const fileUrl = `file://${filePath}?t=${Date.now()}`;
    const importedModule = await import(fileUrl);
    activeModules.set(moduleName, { 
      status: 'active', 
      updated: Date.now(), 
      exports: Object.keys(importedModule) 
    });
    console.log(`[HMR-MESH] Successfully injected ${moduleName}`);
  } catch (e) {
    console.error(`[HMR-MESH] Failed to compile ${filePath}:`, e.message);
    const moduleName = path.basename(filePath, '.js');
    activeModules.set(moduleName, { status: 'error', updated: Date.now(), error: e.message });
  }
}

app.get('/api/modules', (req, res) => {
  res.json(Object.fromEntries(activeModules));
});

app.listen(PORT, () => {
  console.log(`[HMR-MESH] HMR Mesh listening on port ${PORT}`);
});
