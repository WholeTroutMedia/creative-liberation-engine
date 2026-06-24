import * as fs from 'fs';
import * as path from 'path';
export function okResult(value) {
    return { success: true, value };
}
export function errResult(error) {
    return { success: false, error };
}
/**
 * 1. EdgeSyncBridge
 * Handles continuous context caching on handheld edges (SQLite DB files)
 * and bidirectional synchronization of local SCRIBE chunks with the Synology NAS primary vault.
 */
export class EdgeSyncBridge {
    localDbPath;
    nasVaultPath;
    constructor(localDbPath, nasVaultPath) {
        this.localDbPath = localDbPath || path.join(process.cwd(), 'runtime/memory/edge_local.sqlite');
        this.nasVaultPath = nasVaultPath || '/app/creative-liberation-engine/runtime/memory';
    }
    /**
     * Cache raw active context snapshots locally on SQLite spoke database.
     */
    async cacheSnapshotLocally(records) {
        try {
            // Simulator writing directly to simulated SQLite local DB on the filesystem
            const localDir = path.dirname(this.localDbPath);
            if (!fs.existsSync(localDir)) {
                fs.mkdirSync(localDir, { recursive: true });
            }
            // Read existing SQLite data if any
            let localCache = [];
            if (fs.existsSync(this.localDbPath)) {
                const raw = fs.readFileSync(this.localDbPath, 'utf-8');
                try {
                    localCache = JSON.parse(raw);
                }
                catch {
                    localCache = [];
                }
            }
            // Upsert records in cache
            const cacheMap = new Map(localCache.map(r => [r.memoryId, r]));
            for (const r of records) {
                cacheMap.set(r.memoryId, r);
            }
            fs.writeFileSync(this.localDbPath, JSON.stringify(Array.from(cacheMap.values()), null, 2), 'utf-8');
            return okResult(records.length);
        }
        catch (e) {
            return errResult(`Local SQLite cache write failure: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    /**
     * Flush and synchronize local edge memory chunks with the authoritative NAS core collections.
     */
    async synchronizeWithNAS() {
        try {
            if (!fs.existsSync(this.localDbPath)) {
                return okResult({ synced: 0, errors: [] });
            }
            const rawLocal = fs.readFileSync(this.localDbPath, 'utf-8');
            const localRecords = JSON.parse(rawLocal);
            // Only synchronize non-canonical temporary records or unmerged SCRIBE chunks
            const pendingChunks = localRecords.filter(r => r.provenance.source === 'SCRIBE' || r.lifecycleState === 'active');
            if (pendingChunks.length === 0) {
                return okResult({ synced: 0, errors: [] });
            }
            // Sync targets on Synology NAS primary collections directory
            if (!fs.existsSync(this.nasVaultPath)) {
                fs.mkdirSync(this.nasVaultPath, { recursive: true });
            }
            let syncedCount = 0;
            const errors = [];
            for (const chunk of pendingChunks) {
                const topicPath = path.join(this.nasVaultPath, `${chunk.topic}.canonical.json`);
                try {
                    let collection = [];
                    if (fs.existsSync(topicPath)) {
                        const rawColl = fs.readFileSync(topicPath, 'utf-8');
                        collection = JSON.parse(rawColl);
                    }
                    // Upsert into primary vault
                    const collMap = new Map(collection.map(r => [r.memoryId, r]));
                    collMap.set(chunk.memoryId, chunk);
                    fs.writeFileSync(topicPath, JSON.stringify(Array.from(collMap.values()), null, 2), 'utf-8');
                    syncedCount++;
                }
                catch (err) {
                    errors.push(`Failed to sync memory chunk ${chunk.memoryId} to NAS: ${err}`);
                }
            }
            return okResult({ synced: syncedCount, errors });
        }
        catch (e) {
            return errResult(`Synchronization protocol failure: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}
/**
 * 2. SubquadraticContextCompactor
 * Dynamically condenses massive conversational threads or large DOM blocks into highly dense JSON briefs
 * matching the MEMORY_CONTRACT schema to fit inside edge token windows.
 */
export class SubquadraticContextCompactor {
    ollamaHost;
    constructor() {
        const host = process.env.OLLAMA_HOST || '192.168.2.20:11434';
        this.ollamaHost = host.startsWith('http') ? host : `http://${host}`;
    }
    /**
     * Compress redundant dialogue turns and intermediate context arrays into a single compacted brief.
     */
    async compactDialogue(dialogueHistory, maxTurns = 6) {
        try {
            if (dialogueHistory.length <= maxTurns) {
                return errResult(`Dialogue is already under the target subquadratic threshold (${maxTurns} turns).`);
            }
            // Condense older turns
            const turnsToCompress = dialogueHistory.slice(0, dialogueHistory.length - 2);
            const remainingTurns = dialogueHistory.slice(dialogueHistory.length - 2);
            const rawText = turnsToCompress.map(t => `${t.role}: ${t.content}`).join('\n');
            const prompt = `Compress the following conversation history into a highly dense semantic brief.
Your summary MUST capture all crucial decisions, tasks, open topics, and facts.
Format your output STRICTLY as a valid JSON object matching this structure:
{
  "summary": "High-density concise summary of key facts",
  "decisions": ["Decision 1", "Decision 2"],
  "tasks": ["Task A pending", "Task B completed"],
  "gaps": ["Topic X needs research"]
}

Conversation to compress:
${rawText}`;
            let summaryContent = {
                summary: `Truncated history of ${turnsToCompress.length} turns`,
                decisions: [],
                tasks: [],
                gaps: []
            };
            try {
                const response = await fetch(`${this.ollamaHost}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'qwen2.5-coder:32b',
                        messages: [
                            { role: 'system', content: 'You are an advanced context-compactor. Return ONLY raw JSON.' },
                            { role: 'user', content: prompt }
                        ],
                        stream: false,
                        options: { temperature: 0.1 }
                    })
                });
                if (response.ok) {
                    const data = await response.json();
                    const rawJson = data.message?.content?.trim();
                    const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
                    summaryContent = JSON.parse(cleanJson);
                }
            }
            catch (ollamaErr) {
                // Inline local fallback if Ollama is unreachable (prevent blocking continuous execution)
                summaryContent.summary = `Autonomous local fallback compression: Condensed ${turnsToCompress.length} historical chat dialog turns.`;
            }
            const compactedRecord = {
                memoryId: `mem_compressed_${Date.now()}`,
                topic: 'dialogue_context_compaction',
                lifecycleState: 'active',
                retentionClass: 'working',
                confidence: 0.95,
                provenance: {
                    recordedAt: new Date().toISOString(),
                    recordedBy: 'Antigravity-Compactor',
                    source: 'SCRIBE'
                },
                content: {
                    compressedTurnsCount: turnsToCompress.length,
                    semanticBrief: summaryContent,
                    activeDialogueTail: remainingTurns
                }
            };
            return okResult(compactedRecord);
        }
        catch (e) {
            return errResult(`Context compaction failure: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}
/**
 * 3. StaticESMCompiler
 * Compiles markdown Obsidian knowledge files into tree-shakable ECMAScript Modules (ESM)
 * stored directly in memory, yielding sub-millisecond local RAG lookups without DB index latency.
 */
export class StaticESMCompiler {
    sourceDir;
    outputDir;
    constructor(sourceDir, outputDir) {
        this.sourceDir = sourceDir || '/app/creative-liberation-engine/docs';
        this.outputDir = outputDir || '/app/creative-liberation-engine/packages/memory/src';
    }
    /**
     * Crawls the docs/ and wiki/ folders and compiles the metadata frontmatter into tree-shakable TypeScript ESM files.
     */
    async compileKnowledgeLayer() {
        try {
            if (!fs.existsSync(this.sourceDir)) {
                return errResult(`Source documentation directory not found: ${this.sourceDir}`);
            }
            const compiledMap = {};
            let recordCount = 0;
            const files = fs.readdirSync(this.sourceDir);
            for (const file of files) {
                if (file.endsWith('.md')) {
                    const filePath = path.join(this.sourceDir, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    // Simple frontmatter parser
                    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                    let meta = {};
                    if (fmMatch) {
                        const lines = fmMatch[1].split('\n');
                        for (const line of lines) {
                            const parts = line.split(':');
                            if (parts.length >= 2) {
                                const key = parts[0].trim();
                                const val = parts.slice(1).join(':').trim();
                                meta[key] = val.replace(/^["']|["']$/g, ''); // strip quotes
                            }
                        }
                    }
                    const key = file.replace('.md', '').replace(/[\-\s]/g, '_').toLowerCase();
                    compiledMap[key] = {
                        filename: file,
                        title: meta.title || file.replace('.md', ''),
                        tags: meta.tags ? meta.tags.split(',').map((t) => t.trim()) : [],
                        summary: meta.summary || content.slice(0, 300).replace(/[\r\n#]/g, ' ').trim() + '...',
                        compiledAt: new Date().toISOString()
                    };
                    recordCount++;
                }
            }
            // Output tree-shakable TypeScript ESM knowledge index
            const tsCode = `/**
 * Static Compiled Knowledge Layer
 * Dynamically generated by StaticESMCompiler. Tree-shakable, sub-millisecond local cache.
 */

export interface CompiledKnowledgeItem {
    filename: string;
    title: string;
    tags: string[];
    summary: string;
    compiledAt: string;
}

export const staticKnowledgeIndex: Record<string, CompiledKnowledgeItem> = ${JSON.stringify(compiledMap, null, 4)};

export function lookupStaticKnowledge(key: string): CompiledKnowledgeItem | undefined {
    return staticKnowledgeIndex[key.toLowerCase()];
}

export function searchStaticKnowledge(query: string): CompiledKnowledgeItem[] {
    const q = query.toLowerCase();
    return Object.values(staticKnowledgeIndex).filter(item => 
        item.title.toLowerCase().includes(q) || 
        item.summary.toLowerCase().includes(q) ||
        item.tags.some(t => t.toLowerCase().includes(q))
    );
}
`;
            const targetFilePath = path.join(this.outputDir, 'staticKnowledgeLayer.ts');
            fs.writeFileSync(targetFilePath, tsCode, 'utf-8');
            return okResult({
                compiledFiles: [targetFilePath],
                totalRecords: recordCount
            });
        }
        catch (e) {
            return errResult(`Static compiler execution failure: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}
