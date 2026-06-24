/**
 * capability-watcher — Speculative Runner Watcher
 *
 * Watches code files under packages/ and services/ for changes.
 * On write, it debounces the event and posts a validation task
 * to the Creative Liberation Engine dispatch queue.
 *
 * Part of Lane 2: Ambient Speculative Execution
 */

import chokidar from 'chokidar';
import path from 'path';
import { randomUUID } from 'crypto';

export interface SpeculativeRunnerConfig {
    workspaceRoot: string;
    dispatchUrl: string;
    debounceMs?: number;
    verbose?: boolean;
}

export function startSpeculativeRunner(config: SpeculativeRunnerConfig) {
    const {
        workspaceRoot,
        dispatchUrl,
        debounceMs = 1200,
        verbose = true,
    } = config;

    const log = (msg: string) => { if (verbose) console.log(`[speculative-runner] ${msg}`); };

    const watchPaths = [
        path.join(workspaceRoot, 'packages'),
        path.join(workspaceRoot, 'services'),
    ];

    const watcher = chokidar.watch(watchPaths, {
        ignored: (val) => {
            if (val.includes('node_modules') || 
                val.includes('dist') || 
                val.includes('.turbo') || 
                val.includes('.git') || 
                val.includes('build') ||
                val.includes('open-design') ||
                val.includes('gen-ui') ||
                val.includes('landing-page')) {
                return true;
            }
            // Only watch files with .ts or .mjs extensions
            const ext = path.extname(val);
            if (ext && ext !== '.ts' && ext !== '.mjs') {
                return true;
            }
            return false;
        },
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
    });

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingFiles = new Set<string>();

    const dispatchValidationTask = async (filePath: string) => {
        const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
        // Extract package or service name
        const parts = relativePath.split('/');
        const segment = parts[0]; // 'packages' or 'services'
        const moduleName = parts[1] || 'unknown';
        const componentName = `${segment}/${moduleName}`;

        log(`File change in ${componentName}: ${relativePath} — queueing speculative validation`);

        const task = {
            project: process.env.PROJECT || 'creative-liberation-engine',
            workstream: 'speculative.validation',
            title: `Speculative Test: ${componentName}`,
            description: `Auto-triggered speculative validation for change in ${relativePath}`,
            priority: 'P2',
            source: 'speculative-watcher',
            metadata: {
                filepath: relativePath,
                component: componentName,
                timestamp: new Date().toISOString(),
                eventId: randomUUID()
            },
            created_by: 'speculative-runner',
            assigned_to_capability: 'test-runner'
        };

        try {
            const response = await fetch(`${dispatchUrl}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task)
            });

            if (!response.ok) {
                console.error(`[speculative-runner] ❌ Dispatch task post failed: ${response.status}`);
                return;
            }

            const data = await response.json() as any;
            log(`✅ Speculative validation task queued: ${data.task_id || data.id}`);
        } catch (err: any) {
            console.error(`[speculative-runner] ❌ Dispatch connection error:`, err.message);
        }
    };

    const flushQueue = () => {
        const filesToProcess = Array.from(pendingFiles);
        pendingFiles.clear();

        // Trigger validation for each changed component (deduplicated by component/package)
        const componentsProcessed = new Set<string>();
        for (const filePath of filesToProcess) {
            const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
            const parts = relativePath.split('/');
            const componentKey = `${parts[0]}/${parts[1]}`;
            if (!componentsProcessed.has(componentKey)) {
                componentsProcessed.add(componentKey);
                dispatchValidationTask(filePath).catch(err => {
                    console.error('[speculative-runner] dispatch error:', err);
                });
            }
        }
    };

    const handleChange = (filePath: string) => {
        pendingFiles.add(filePath);
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(flushQueue, debounceMs);
    };

    watcher
        .on('change', handleChange)
        .on('add', handleChange)
        .on('unlink', handleChange)
        .on('error', (err: any) => console.error('[speculative-runner] watcher error:', err.message))
        .on('ready', () => log(`Speculative watcher active in ${workspaceRoot} (packages & services)`));

    return {
        close: async () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            await watcher.close();
            log('Speculative watcher stopped.');
        }
    };
}
