import Redis from 'ioredis';

// Use lazyConnect so ioredis won't throw on module load if Redis is unavailable.
// An error handler is required to prevent Node's uncaught-exception crash.
const REDIS_URL = process.env.REDIS_URL || '';
const redis = REDIS_URL
    ? new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1 })
    : null;
if (redis) {
    redis.on('error', (err: Error) => {
        // Non-fatal — transcript store degrades silently in environments without Redis
        console.warn('[TRANSCRIPT STORE] Redis unavailable (non-fatal):', err.message);
    });
    redis.connect().catch(() => {/* intentional no-op */});
}

export interface SessionTranscript {
    sessionId: string;
    transcript: string;
    timestamp: string;
}

export class TranscriptStore {
    /**
     * Store an audio session transcript for IDEATE/PLAN flows to read on session close.
     */
    async saveTranscript(sessionId: string, transcript: string): Promise<void> {
        if (!redis) return;
        const payload: SessionTranscript = {
            sessionId,
            transcript,
            timestamp: new Date().toISOString()
        };
        // Store for 7 days
        await redis.set(`transcript:${sessionId}`, JSON.stringify(payload), 'EX', 60 * 60 * 24 * 7);
        console.log(`[TRANSCRIPT STORE] Saved transcript for session ${sessionId}`);
    }

    /**
     * Retrieve a previously saved session transcript.
     */
    async getTranscript(sessionId: string): Promise<SessionTranscript | null> {
        if (!redis) return null;
        const data = await redis.get(`transcript:${sessionId}`);
        if (!data) return null;
        return JSON.parse(data) as SessionTranscript;
    }
}

export const transcriptStore = new TranscriptStore();
