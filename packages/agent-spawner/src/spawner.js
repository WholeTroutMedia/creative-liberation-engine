import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { CheckpointManager } from './CheckpointManager.js';
import { ContextCompressor } from '../../memory/src/ContextCompressor.js';
const execAsync = promisify(exec);
/**
 * Agent Spawner
 * Self-replication and horizontal scaling layer for the Creative Liberation Engine.
 *
 * V6 Cognitive Upgrades:
 *   - Auto-checkpoints agent state to NAS on spawn (multi-day persistence)
 *   - Context compression via local Ollama before handoff
 *   - State cleanup policy: purges expired checkpoints (>7 days)
 */
export class AgentSpawner {
    baseDir;
    checkpoint = new CheckpointManager();
    compressor = new ContextCompressor();
    constructor(baseDir = process.cwd()) {
        this.baseDir = baseDir;
    }
    /**
     * Dynamically spin up a new operational agent based on a SkillManifest.
     * If resumeFromCheckpoint is true, attempts to restore prior execution state.
     */
    async spawnFromManifest(manifest, options = {}) {
        console.log(`[AGENT SPAWNER] Initiating replication for agent: ${manifest.agent}`);
        const port = options.port || await this.findAvailablePort();
        const targetDir = options.targetDir || path.join(this.baseDir, '.agents', 'runtime', manifest.agent);
        const agentId = manifest.agent.toLowerCase().replace(/\s+/g, '-');
        // ── RESUME PATH ──────────────────────────────────────────────
        if (options.resumeFromCheckpoint && options.resumeToken) {
            console.log(`[AGENT SPAWNER] Attempting checkpoint resume for ${agentId}...`);
            const restored = await this.checkpoint.resumeAgent(agentId, options.resumeToken);
            if (restored.ok) {
                console.log(`[AGENT SPAWNER] ✅ Resumed from checkpoint (${restored.value.hibernatedAt})`);
                return {
                    pid: 9999,
                    port,
                    agentId,
                    resumeToken: restored.value.resumeToken,
                    resumedFrom: restored.value.hibernatedAt,
                };
            }
            else {
                console.warn(`[AGENT SPAWNER] ⚠️ Resume failed (${restored.error}), spawning fresh`);
            }
        }
        await fs.mkdir(targetDir, { recursive: true });
        // Generate the executable entrypoint
        const entrypoint = this.generateEntrypoint(manifest, port);
        await fs.writeFile(path.join(targetDir, 'index.ts'), entrypoint);
        // Generate package.json
        const pkgJson = {
            name: `@cle-runtime/${manifest.agent.toLowerCase()}`,
            version: '1.0.0',
            private: true,
            type: "module",
            scripts: {
                start: "tsx index.ts"
            }
        };
        await fs.writeFile(path.join(targetDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
        console.log(`[AGENT SPAWNER] Launching process for ${manifest.agent} on port ${port}...`);
        // ── AUTO-CHECKPOINT ──────────────────────────────────────────
        // Persist initial spawn state so the agent can be resumed later
        const spawnContext = {
            manifest,
            port,
            targetDir,
            spawnedAt: new Date().toISOString(),
            skills: manifest.skills.map(s => s.name),
        };
        const ckResult = await this.checkpoint.hibernateAgent(agentId, spawnContext);
        let resumeToken;
        if (ckResult.ok) {
            resumeToken = ckResult.value.resumeToken;
            console.log(`[AGENT SPAWNER] 💾 Checkpoint saved → ${resumeToken}`);
        }
        else {
            console.warn(`[AGENT SPAWNER] ⚠️ Checkpoint save failed: ${ckResult.error}`);
        }
        return {
            pid: 9999, // mock — in production this dispatches to pm2/k8s
            port,
            agentId,
            resumeToken,
        };
    }
    /**
     * Compress raw observational context before passing to an agent.
     * Uses the local Ollama instance (qwen3-coder) for sovereign inference.
     */
    async compressContext(rawInput, strategy = 'dom') {
        console.log(`[AGENT SPAWNER] Compressing ${strategy} context (${rawInput.length} chars)...`);
        const result = await this.compressor.compressObservation(rawInput, strategy);
        if (result.ok) {
            console.log(`[AGENT SPAWNER] ✅ Compressed: ${rawInput.length} → ${result.value.length} chars`);
            return result.value;
        }
        else {
            console.warn(`[AGENT SPAWNER] ⚠️ Compression failed: ${result.error}, using raw input`);
            return rawInput;
        }
    }
    /**
     * Hibernate an active agent, persisting its full execution context to NAS.
     */
    async hibernateAgent(agentId, context) {
        const result = await this.checkpoint.hibernateAgent(agentId, context);
        if (result.ok) {
            console.log(`[AGENT SPAWNER] 💤 Agent ${agentId} hibernated → ${result.value.resumeToken}`);
            return result.value;
        }
        console.error(`[AGENT SPAWNER] ❌ Hibernate failed: ${result.error}`);
        return null;
    }
    /**
     * Resume a hibernated agent from NAS checkpoint.
     */
    async resumeAgent(agentId, resumeToken) {
        const result = await this.checkpoint.resumeAgent(agentId, resumeToken);
        if (result.ok) {
            console.log(`[AGENT SPAWNER] ✅ Agent ${agentId} resumed from ${result.value.hibernatedAt}`);
            return result.value.context;
        }
        console.error(`[AGENT SPAWNER] ❌ Resume failed: ${result.error}`);
        return null;
    }
    /**
     * State cleanup policy: purge NAS checkpoints older than maxAgeDays.
     * Constitutional compliance: prevents unbounded state accumulation.
     */
    async purgeExpiredCheckpoints(maxAgeDays = 7) {
        const stateDir = '\\\\127.0.0.1\\docker\\creative-liberation-engine\\runtime\\state';
        const purged = [];
        const errors = [];
        try {
            const files = await fs.readdir(stateDir);
            const cutoffMs = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
            for (const file of files) {
                if (!file.endsWith('.json'))
                    continue;
                const fullPath = path.join(stateDir, file);
                try {
                    const raw = await fs.readFile(fullPath, 'utf-8');
                    const checkpoint = JSON.parse(raw);
                    const hibernatedAt = new Date(checkpoint.hibernatedAt).getTime();
                    if (hibernatedAt < cutoffMs) {
                        await fs.unlink(fullPath);
                        purged.push(file);
                        console.log(`[AGENT SPAWNER] 🗑️ Purged expired checkpoint: ${file}`);
                    }
                }
                catch (e) {
                    errors.push(`${file}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
        }
        catch (e) {
            errors.push(`readdir failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        return { purged, errors };
    }
    generateEntrypoint(manifest, port) {
        return `
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Dynamically generated agent: ${manifest.agent}
// Skills: ${manifest.skills.map((s) => s.name).join(', ')}

const ai = genkit({
    plugins: [googleAI()],
    model: 'googleAI/gemini-2.5-flash-preview-04-17'
});

console.log('[RUNTIME] Agent ${manifest.agent} online on port ${port}');

// CLE ZERO DAY dispatch mapping would connect here
`;
    }
    async findAvailablePort() {
        // Mock port allocation
        return Math.floor(Math.random() * 1000) + 4000;
    }
}
//# sourceMappingURL=spawner.js.map