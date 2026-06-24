/**
 * Auto-retrieve — Chroma-backed memory injection for thin-client surfaces.
 * Default ON. Set CLE_AUTO_RETRIEVE=0 to disable (tests / offline).
 */

import { ai } from '../index.js';
import { qdrantRetriever } from '../tools/qdrant-retriever.js';

const DISABLED = process.env.CLE_AUTO_RETRIEVE === '0';

function snippet(text: unknown, max = 600): string {
    if (text == null) return '';
    const s = typeof text === 'string' ? text : JSON.stringify(text);
    return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/** Extract text from a Genkit retrieve() document node. */
function docText(d: unknown): string {
    if (d == null) return '';
    const o = d as { content?: Array<{ text?: string }> | string };
    if (typeof o.content === 'string') return o.content;
    const t = o.content?.[0]?.text;
    return typeof t === 'string' ? t : '';
}

/** Build a compact block for system-prompt injection from Genkit retrieve() output (array of docs). */
export function formatRetrievePayload(payload: unknown): string {
    if (payload == null) return '';
    const docs = Array.isArray(payload) ? payload : (payload as { documents?: unknown[] }).documents;
    if (!Array.isArray(docs) || docs.length === 0) return '';
    const lines = docs
        .map((d, i) => {
            const c = snippet(docText(d), 800);
            return c ? `[${i + 1}] ${c}` : '';
        })
        .filter(Boolean);
    return lines.join('\n\n');
}

/**
 * Semantic recall from Chroma via Genkit retriever. Never throws — returns '' on failure.
 */
export async function autoRetrieveContext(query: string, nResults = 5): Promise<string> {
    if (DISABLED) return '';
    const q = query?.trim();
    if (!q) return '';
    try {
        const results = await ai.retrieve({
            retriever: qdrantRetriever,
            query: q,
            options: { collection: process.env.QDRANT_DEFAULT_COLLECTION || 'cle-memory', limit: nResults },
        });
        return formatRetrievePayload(results);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[AUTO-RETRIEVE] skipped:', msg);
        return '';
    }
}

/** Derive a search query from /generate-style bodies. */
export function memoryQueryFromBody(body: {
    prompt?: unknown;
    messages?: unknown;
}): string {
    if (typeof body.prompt === 'string' && body.prompt.trim()) {
        return body.prompt.trim().slice(0, 4000);
    }
    const msgs = body.messages;
    if (!Array.isArray(msgs)) return '';
    for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i] as { role?: string; content?: unknown };
        if (m?.role === 'user' && m.content != null) {
            if (typeof m.content === 'string') return m.content.trim().slice(0, 4000);
            if (Array.isArray(m.content)) {
                const text = m.content
                    .map((p: { text?: string }) => (typeof p?.text === 'string' ? p.text : ''))
                    .join(' ')
                    .trim();
                if (text) return text.slice(0, 4000);
            }
        }
    }
    return '';
}

const PREFIX = '## Institutional memory (auto-retrieved)\n';

/** Prefix system prompt with retrieved context when non-empty. */
export function mergeSystemWithMemory(system: string | undefined, memoryBlock: string): string | undefined {
    if (!memoryBlock) return system;
    const block = `${PREFIX}${memoryBlock}`;
    if (!system?.trim()) return block;
    return `${system.trim()}\n\n${block}`;
}
