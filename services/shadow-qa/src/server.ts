/**
 * Shadow QA Service â€” Dispatch Worker
 *
 * Automatically triggered after every Surgical Mode file change.
 * Runs: TypeScript build check â†’ pnpm test â†’ reports results.
 *
 * Called via POST /qa/trigger from:
 * - Surgical Mode workflow (after every approved change)
 * - Any Creative Liberation Engine agent that ships code
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import cluster from 'node:cluster';
import os from 'node:os';

const execAsync = promisify(exec);
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env['SHADOW_QA_PORT'] ?? 4400;
const MONOREPO_ROOT = process.env['MONOREPO_ROOT']
    ?? 'C:/Creative-Liberation-Engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QATrigger {
    changedFile: string;
    changeDescription: string;
    packageName?: string;
}

interface QAResult {
    id: string;
    changedFile: string;
    changeDescription: string;
    packageName: string;
    typeCheck: { passed: boolean; output: string; durationMs: number };
    tests: { passed: boolean; output: string; durationMs: number; skipped?: boolean };
    overall: 'PASS' | 'FAIL' | 'WARN';
    timestamp: string;
}

// ---------------------------------------------------------------------------
// Package Detection
// ---------------------------------------------------------------------------

function detectPackage(filePath: string): string {
    const rel = filePath.replace(/\\/g, '/');
    if (rel.includes('packages/genkit')) return '@cle/genkit';
    if (rel.includes('packages/genmedia')) return '@cle/genmedia';
    if (rel.includes('packages/finance-agent')) return '@cle/finance-agent';
    if (rel.includes('packages/memory')) return '@cle/memory';
    if (rel.includes('packages/auth')) return '@cle/auth';
    if (rel.includes('packages/blueprints')) return '@cle/blueprints';
    if (rel.includes('packages/constitution')) return '@cle/constitution';
    if (rel.includes('packages/campaign')) return '@cle/campaign';
    if (rel.includes('packages/zero-day')) return '@cle/zero-day';
    if (rel.includes('apps/console')) return 'console';
    return 'root';
}

// ---------------------------------------------------------------------------
// QA Runner
// ---------------------------------------------------------------------------

async function runQA(trigger: QATrigger): Promise<QAResult> {
    const id = `qa-${Date.now()}`;
    const packageName = trigger.packageName ?? detectPackage(trigger.changedFile);
    const timestamp = new Date().toISOString();

    console.log(`[SHADOW-QA] â–¶ Running QA for ${packageName} | ${trigger.changeDescription}`);

    // --- TypeScript Build Check ---
    const tsStart = Date.now();
    let typeCheck: QAResult['typeCheck'];
    try {
        const filter = packageName === 'root' ? '' : `--filter ${packageName}`;
        const { stdout, stderr } = await execAsync(
            `pnpm ${filter} build 2>&1`,
            { cwd: MONOREPO_ROOT, timeout: 120_000 }
        );
        const output = stdout + stderr;
        const passed = !output.includes('error TS') && !output.includes('Error:');
        typeCheck = { passed, output: output.slice(-2000), durationMs: Date.now() - tsStart };
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        typeCheck = { passed: false, output: errMsg.slice(-2000), durationMs: Date.now() - tsStart };
    }

    // --- Tests ---
    const testStart = Date.now();
    let tests: QAResult['tests'];
    try {
        const filter = packageName === 'root' ? '' : `--filter ${packageName}`;
        const { stdout, stderr } = await execAsync(
            `pnpm ${filter} test 2>&1`,
            { cwd: MONOREPO_ROOT, timeout: 60_000 }
        );
        const output = stdout + stderr;
        const skipped = output.includes('No tests found') || output.includes('missing script');
        const passed = skipped || (!output.includes('FAIL') && !output.includes('failed'));
        tests = { passed, output: output.slice(-2000), durationMs: Date.now() - testStart, skipped };
    } catch (err: unknown) {
        // Exit code 1 from no test runner â€” not a real failure
        const errMsg = err instanceof Error ? err.message : String(err);
        const skipped = errMsg.includes('missing script') || errMsg.includes('No such script');
        tests = {
            passed: skipped,
            output: skipped ? '[No test script configured]' : errMsg.slice(-2000),
            durationMs: Date.now() - testStart,
            skipped,
        };
    }

    const overall: QAResult['overall'] = !typeCheck.passed ? 'FAIL'
        : !tests.passed ? 'FAIL'
            : 'PASS';

    const result: QAResult = {
        id, changedFile: trigger.changedFile, changeDescription: trigger.changeDescription,
        packageName, typeCheck, tests, overall, timestamp,
    };

    const icon = overall === 'PASS' ? 'âœ“' : 'âœ—';
    console.log(`[SHADOW-QA] ${icon} ${overall} | TS: ${typeCheck.passed ? 'PASS' : 'FAIL'} | Tests: ${tests.skipped ? 'SKIP' : tests.passed ? 'PASS' : 'FAIL'}`);
    return result;
}

// ---------------------------------------------------------------------------
// Result Store (in-memory ring buffer)
// ---------------------------------------------------------------------------

const results: QAResult[] = [];
const MAX_RESULTS = 50;

function storeResult(result: QAResult): void {
    results.push(result);
    if (results.length > MAX_RESULTS) results.shift();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
    res.json({ status: 'operational', service: 'shadow-qa', version: '1.0.0' });
});

// Triggered by Surgical Mode after every approved change
app.post('/qa/trigger', async (req, res) => {
    const trigger = req.body as QATrigger;
    if (!trigger.changedFile) {
        return res.status(400).json({ error: '"changedFile" is required' });
    }

    // Run async â€” respond with accepted immediately, result available via /qa/results
    const resultPromise = runQA(trigger);
    res.status(202).json({ message: 'QA triggered', id: `qa-${Date.now()}` });

    const result = await resultPromise;
    storeResult(result);
});

// Synchronous version â€” waits for QA to complete before responding
app.post('/qa/run', async (req, res) => {
    const trigger = req.body as QATrigger;
    if (!trigger.changedFile) {
        return res.status(400).json({ error: '"changedFile" is required' });
    }
    const result = await runQA(trigger);
    storeResult(result);
    res.json(result);
});

app.get('/qa/results', (_req, res) => {
    res.json(results.slice().reverse());
});

app.get('/qa/latest', (_req, res) => {
    res.json(results[results.length - 1] ?? null);
});

// ---------------------------------------------------------------------------
// Start (Cluster Orchestration for Ryzen 9 5950X / Heavy Hardware)
// ---------------------------------------------------------------------------

if (cluster.isPrimary) {
    const numCPUs = Math.min(os.cpus().length, 32);
    console.log(`[SHADOW-QA] Primary process ${process.pid} is running.`);
    console.log(`[SHADOW-QA] ðŸ§ª Orchestrating ${numCPUs} parallel QA workers (Hardware Optimization)...`);
    console.log(`[SHADOW-QA]   Monorepo root: ${MONOREPO_ROOT}`);
    console.log(`[SHADOW-QA]   POST /qa/trigger â€” async QA trigger (from Surgical Mode)`);
    console.log(`[SHADOW-QA]   POST /qa/run     â€” synchronous QA run`);
    console.log(`[SHADOW-QA]   GET  /qa/results â€” QA history`);
    console.log(`[SHADOW-QA]   GET  /qa/latest  â€” last QA result`);

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker: any, code: any, signal: any) => {
        console.warn(`[SHADOW-QA] Worker ${worker.process.pid} died. Forking a replacement...`);
        cluster.fork();
    });
} else {
    app.listen(PORT, () => {
        console.log(`[SHADOW-QA] Worker ${process.pid} ready on :${PORT}`);
    });
}

export default app;
