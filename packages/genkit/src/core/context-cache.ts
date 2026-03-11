import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleAICacheManager } from '@google/generative-ai/server';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const cacheManager = new GoogleAICacheManager(apiKey as string);

// Current active cache name for the system omnipresence
let omnipresenceCacheName: string | null = null;
let initializationPromise: Promise<string | null> | null = null;

/**
 * Initializes the Long-Context Cache (SCRIBE Omnipresence).
 * Compresses the engine's core instructions and memory into a persistent Gemini KV cache.
 */
export async function initializeOmnipresenceCache(): Promise<string | null> {
    if (!apiKey) {
        console.warn('[CONTEXT-CACHE] ⚠️ No Gemini API key found. SCRIBE Omnipresence cache disabled.');
        return null;
    }
    
    if (omnipresenceCacheName) {
        return omnipresenceCacheName;
    }

    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            console.log('[CONTEXT-CACHE] 🚀 Initializing SCRIBE Omnipresence KV Cache...');
            
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const projectRoot = path.resolve(__dirname, '../../../../');
            
            // Core files to inject into the panopticon context
            const constitutionPath = path.join(projectRoot, 'CONSTITUTION.md');
            const agentsPath = path.join(projectRoot, 'AGENTS.md');
            
            let combinedContext = '';
            
            if (fs.existsSync(constitutionPath)) {
                combinedContext += '# Creative Liberation Engine CONSTITUTION\n' + fs.readFileSync(constitutionPath, 'utf8') + '\n\n';
            }
            if (fs.existsSync(agentsPath)) {
                combinedContext += '# OPERATIONAL DOCTRINE (AGENTS.md)\n' + fs.readFileSync(agentsPath, 'utf8') + '\n\n';
            }

            // We use genkit's default gemini model for complex reasoning
            const modelName = 'models/gemini-1.5-pro-002';

            const cacheResult = await cacheManager.create({
                model: modelName,
                displayName: 'SCRIBE_OMNIPRESENCE',
                systemInstruction: "You are the Creative Liberation Engine. Adhere to all constitutional laws.",
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: combinedContext }
                        ],
                    },
                ],
                ttlSeconds: 86400, // 24 hours
            });

            omnipresenceCacheName = cacheResult.name || 'OMNIPRESENCE_BETA';
            console.log(`[CONTEXT-CACHE] ✅ SCRIBE Omnipresence active. Cache Name: ${omnipresenceCacheName}`);
            
            const expStr = cacheResult.expireTime ? new Date(cacheResult.expireTime).toLocaleString() : 'Unknown';
            console.log(`[CONTEXT-CACHE] 📉 Ephemeral Context compacted. Expiration: ${expStr}`);
            return omnipresenceCacheName;
        } catch (error: any) {
             console.error('[CONTEXT-CACHE] ❌ Failed to initialize context cache:', error.message);
             return null;
        } finally {
            initializationPromise = null;
        }
    })();

    return initializationPromise;
}

/**
 * Retrieves the active cache name, or null if not initialized/disabled.
 */
export function getOmnipresenceCacheName(): string | null {
    return omnipresenceCacheName;
}

/**
 * Standard utility to upgrade a Genkit ai.generate options object with the KV Cache 
 * parameters if the cache is active.
 */
export function applyOmnipresenceCache<T>(options: T): T {
    const cache = getOmnipresenceCacheName();
    if (!cache) return options;
    
    return {
        ...options,
        model: 'googleai/gemini-1.5-pro', // Required for 002 cache support
        system: `[SCRIBE OMNIPRESENCE KV CACHE ACTIVE]\n` + ((options as any).system || ''),
        config: {
            ...((options as any).config || {}),
            version: 'gemini-1.5-pro-002',
            cachedContent: cache
        }
    } as T;
}
