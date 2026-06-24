/**
 * capability-watcher â€” Main Entry Point
 *
 * Starts the file watcher daemon. Configuration is read from environment
 * variables for Docker/NAS deployability:
 *
 *   WORKSPACE_ROOT   â€” absolute path to creative-liberation-engine-v5 (default: auto-detected)
 *   DISPATCH_URL     â€” dispatch server base URL (default: http://127.0.0.1:5050)
 *   DEBOUNCE_MS      â€” debounce delay in ms (default: 800)
 *   WORKSPACE_ROOT   — absolute path to creative-liberation-engine-v5 (default: auto-detected)
 *   DISPATCH_URL     — dispatch server base URL (default: http://127.0.0.1:5050)
 *   DEBOUNCE_MS      — debounce delay in ms (default: 800)
 *   VERBOSE          — set to 'false' to suppress logs (default: true)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { startWatcher } from './watcher.js';
import { startSpeculativeRunner } from './speculative-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auto-detect workspace root: go up from packages/capability-watcher/src → root
const AUTO_ROOT = path.resolve(__dirname, '..', '..', '..');

const workspaceRoot = process.env['WORKSPACE_ROOT'] ?? AUTO_ROOT;
const dispatchUrl = process.env['DISPATCH_URL'] ?? 'http://127.0.0.1:5050';
const debounceMs = parseInt(process.env['DEBOUNCE_MS'] ?? '800', 10);
const verbose = process.env['VERBOSE'] !== 'false';

console.log('[capability-watcher] Starting...');
console.log(`  Workspace: ${workspaceRoot}`);
console.log(`  Dispatch:  ${dispatchUrl}`);
console.log(`  Debounce:  ${debounceMs}ms`);

const capabilityHandle = startWatcher({ workspaceRoot, dispatchUrl, debounceMs, verbose });
const speculativeHandle = startSpeculativeRunner({ workspaceRoot, dispatchUrl, debounceMs: debounceMs + 400, verbose });

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[capability-watcher] SIGTERM received — shutting down...');
    await capabilityHandle.close();
    await speculativeHandle.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[capability-watcher] SIGINT received — shutting down...');
    await capabilityHandle.close();
    await speculativeHandle.close();
    process.exit(0);
});
