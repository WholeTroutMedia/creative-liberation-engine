/**
 * Flipboard Sentinel — Configuration
 * All paths resolve to NAS (sovereignty-first).
 */
export const CONFIG = {
    // RSS Source
    rssUrl: process.env.FLIPBOARD_RSS_URL || 'https://flipboard.com/@jaharoni/ai-hk2mtjn0z.rss',
    pollIntervalMinutes: parseInt(process.env.SENTINEL_POLL_INTERVAL_MINUTES || '15', 10),
    // NAS Paths (sovereign storage)
    // In Docker: /app/creative-liberation-engine/runtime is volume-mounted
    // On Windows: UNC path \\127.0.0.1\docker\creative-liberation-engine\runtime
    nasRoot: process.env.NAS_RUNTIME_PATH || (process.env.NODE_ENV === 'production'
        ? '/app/creative-liberation-engine/runtime'
        : '\\\\127.0.0.1\\docker\\creative-liberation-engine\\runtime'),
    get stateDir() { return `${this.nasRoot}/state`; },
    get queueDir() { return `${this.nasRoot}/ideation-queue`; },
    get counterFile() { return `${this.stateDir}/sentinel-counter.json`; },
    get seenFile() { return `${this.stateDir}/sentinel-seen.json`; },
    // Obsidian Vault
    obsidianVaultPath: process.env.OBSIDIAN_VAULT_PATH || (process.env.NODE_ENV === 'production'
        ? '/app/creative-liberation-engine/runtime/nexus-vault'
        : '\\\\127.0.0.1\\docker\\creative-liberation-engine\\runtime\\nexus-vault'),
    get obsidianSentinelDir() { return `${this.obsidianVaultPath}/Sentinel`; },
    // Email (Gmail)
    gmailUser: process.env.USER_GOOGLE_EMAIL || '',
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
    notifyEmail: process.env.SENTINEL_NOTIFY_EMAIL || 'inquiries@creativeliberationengine.org',
    // Genkit ATHENA endpoint
    genkitBaseUrl: process.env.GENKIT_BASE_URL || 'http://localhost:4100',
    // Tuning
    articleMaxChars: 8000,
    digestThreshold: 3, // If N+ articles in one poll, batch into digest
    crossRefThreshold: 0.4, // Keyword overlap ratio for merge detection
    staleAfterDays: 14, // Auto-archive PENDING ideations older than this
    extractTimeoutMs: 10000, // Timeout for article extraction
    // CLE Relevance — categories that score higher
    highRelevanceTopics: [
        'sovereignty', 'edge-ai', 'local-llm', 'ollama', 'self-hosted',
        'agent', 'mcp', 'genkit', 'comfyui', 'gaussian-splatting',
        'rag', 'embedding', 'nas', 'jetson', 'creative-tools',
        'cinematography', 'broadcast', 'davinci-resolve',
    ],
};
