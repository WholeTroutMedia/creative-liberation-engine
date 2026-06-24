import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { MemoryBus } from './bus.mjs';
import { chromaMemory } from './chroma.js';

export const MemoryEntrySchema = z.object({
    id: z.string(),
    timestamp: z.string(),
    agentName: z.string(),
    task: z.string(),
    outcome: z.string(),
    pattern: z.string().optional().describe('Extracted "The Why" — reusable principle'),
    tags: z.array(z.string()).default([]),
    sessionId: z.string(),
    durationMs: z.number().optional(),
    success: z.boolean(),
});

export const MemoryQuerySchema = z.object({
    query: z.string().describe('Natural language query for similar past tasks'),
    agentName: z.string().optional().describe('Filter by agent'),
    limit: z.number().default(5),
    successOnly: z.boolean().default(false),
    category: z.string().optional().describe('Filter by MemoryCategory'),
    tags: z.array(z.string()).optional().describe('Filter by specific tags (union)'),
});

export const MemoryWriteSchema = z.object({
    agentName: z.string(),
    task: z.string(),
    outcome: z.string(),
    tags: z.array(z.string()).default([]),
    sessionId: z.string(),
    durationMs: z.number().optional(),
    success: z.boolean().default(true),
    metadata: z.record(z.unknown()).optional(),
});

export class LiveMemoryBus {
    constructor() {
        this.memoryDir = process.env.MEMORY_DIR || path.join(process.cwd(), 'runtime/memory');
        if (!existsSync(this.memoryDir)) {
            mkdirSync(this.memoryDir, { recursive: true });
        }
        this.bus = new MemoryBus(this.memoryDir);
        this.chroma = chromaMemory;
        this.patternExtractor = null;
        this.sessionId = `session_${Date.now()}`;
    }

    setPatternExtractor(extractor) {
        this.patternExtractor = extractor;
    }

    async isChromaAvailable() {
        try {
            return await this.chroma.isOnline();
        } catch {
            return false;
        }
    }

    async recall(query) {
        const category = query.category || query.tier;

        // 1. Check for deterministic exact-match optimization (sessionId or tags union)
        if (query.sessionId || (query.tags && query.tags.length > 0)) {
            try {
                const sessions = this.bus.query('sessions', { kind: 'session' });
                let matches = sessions.filter(entry => {
                    if (query.successOnly && entry.success === false) return false;
                    if (query.agentName && entry.agentName !== query.agentName) return false;
                    if (category && entry.category !== category && entry.retentionClass !== category) return false;
                    
                    // Filter by sessionId if specified
                    if (query.sessionId && entry.sessionId !== query.sessionId) return false;
                    
                    // Filter by tags (union) if specified
                    if (query.tags && query.tags.length > 0) {
                        const entryTags = entry.tags || [];
                        if (!query.tags.some(t => entryTags.includes(t))) return false;
                    }
                    
                    // Optional query text filter if provided
                    if (query.query) {
                        const queryLower = query.query.toLowerCase();
                        const text = JSON.stringify(entry).toLowerCase();
                        if (!queryLower.split(/\s+/).some(w => w.length > 3 && text.includes(w))) return false;
                    }
                    
                    return true;
                });
                
                if (matches.length > 0) {
                    return matches.reverse().slice(0, query.limit);
                }
            } catch (err) {
                console.warn(`[MEMORY BUS] Local optimization query error: ${err.message}`);
            }
        }

        if (await this.isChromaAvailable()) {
            try {
                let results = [];
                if (query.agentName) {
                    results = await this.chroma.recall(query.agentName, query.query, query.limit, category, query.tags);
                } else {
                    results = await this.chroma.crossAgentRecall('', query.query, query.limit, category, query.tags);
                }
                if (results && results.length > 0) {
                    return results;
                }
            } catch (err) {
                console.warn(`[MEMORY BUS] ChromaDB recall error: ${err.message}`);
            }
        }

        // Fallback: query from local sessions.index.json or patterns.index.json
        try {
            const sessions = this.bus.query('sessions', { kind: 'session' });
            const queryLower = query.query ? query.query.toLowerCase() : '';
            let matches = sessions.filter(entry => {
                if (query.successOnly && entry.success === false) return false;
                if (query.agentName && entry.agentName !== query.agentName) return false;
                if (!queryLower) return true;
                const text = JSON.stringify(entry).toLowerCase();
                return queryLower.split(/\s+/).some(w => w.length > 3 && text.includes(w));
            });
            return matches.reverse().slice(0, query.limit);
        } catch (err) {
            console.warn(`[MEMORY BUS] JSON fallback query error: ${err.message}`);
            return [];
        }
    }

    async commit(write) {
        const pattern = write.success && this.patternExtractor
            ? await this.patternExtractor(write.task, write.outcome)
            : undefined;

        const entry = {
            id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            pattern,
            ...write,
        };

        // Persist using V6 bus.mjs index collection
        try {
            this.bus.create('sessions', {
                memoryId: entry.id,
                kind: 'session',
                provider: 'SCRIBE',
                topic: write.agentName.toLowerCase(),
                lifecycleState: 'active',
                retentionClass: 'working',
                confidence: 1.0,
                provenance: {
                    recordedAt: entry.timestamp,
                    recordedBy: write.agentName,
                    source: 'SCRIBE',
                },
                content: entry,
                ...entry
            });

            if (pattern) {
                this.bus.create('patterns', {
                    memoryId: `pat_${Date.now()}`,
                    kind: 'pattern',
                    provider: 'SCRIBE',
                    topic: 'patterns',
                    lifecycleState: 'canonical',
                    retentionClass: 'durable',
                    confidence: 1.0,
                    provenance: {
                        recordedAt: entry.timestamp,
                        recordedBy: 'VERA.SCRIBE',
                        source: 'SCRIBE',
                    },
                    content: { pattern, tags: write.tags, sourceAgent: write.agentName },
                });
            }
        } catch (err) {
            console.error(`[MEMORY BUS] Index save failed: ${err.message}`);
        }

        // ChromaDB persist
        if (await this.isChromaAvailable()) {
            this.chroma.persist(entry).catch(err => {
                console.warn(`[MEMORY BUS] ChromaDB persist error: ${err.message}`);
            });
        }

        console.log(`[MEMORY BUS] Committed: ${write.agentName} — "${write.task.slice(0, 60)}"`);
        if (pattern) console.log(`[MEMORY BUS] Pattern extracted: "${pattern.slice(0, 80)}"`);

        return entry;
    }

    async withMemory(agentName, task, tags, fn) {
        const startMs = Date.now();
        const context = await this.recall({ query: task, agentName, limit: 3, successOnly: false });

        let result;
        let success = true;
        let outcome = 'Success';

        try {
            result = await fn(context);
        } catch (e) {
            success = false;
            outcome = `Failed: ${e}`;
            throw e;
        } finally {
            await this.commit({
                agentName,
                task,
                outcome,
                tags,
                sessionId: this.sessionId,
                durationMs: Date.now() - startMs,
                success,
            });
        }

        return result;
    }

    logBoot(system, version, bootDurationMs, meta = {}) {
        console.log(`[MEMORY BUS] Boot logged: ${system} v${version} (${bootDurationMs}ms)`);
        try {
            this.bus.create('sessions', {
                memoryId: `boot_${Date.now()}`,
                kind: 'session',
                provider: 'SYSTEM',
                topic: 'system_boot',
                lifecycleState: 'active',
                retentionClass: 'working',
                confidence: 1.0,
                provenance: {
                    recordedAt: new Date().toISOString(),
                    recordedBy: 'VERA',
                    source: 'MANUAL',
                },
                content: { event: 'boot', system, version, bootDurationMs, ...meta },
            });
        } catch (err) {
            console.warn('[MEMORY BUS] Boot log write skipped:', err.message);
        }
    }

    logShutdown(system, reason = 'clean') {
        console.log(`[MEMORY BUS] Shutdown logged: ${system} (${reason})`);
    }

    logDecision(agent, decision, rationale, tags = []) {
        console.log(`[MEMORY BUS] Decision logged: ${agent} - ${decision}`);
    }

    logUserInteraction(userId, summary, mode) {
        console.log(`[MEMORY BUS] User interaction logged for ${userId}`);
    }

    logCompetencyEvent(eventType, payload) {
        console.log(`[MEMORY BUS] Competency event logged: ${eventType}`);
    }
}

export const memoryBus = new LiveMemoryBus();
// Speculative runner validation trigger check.
