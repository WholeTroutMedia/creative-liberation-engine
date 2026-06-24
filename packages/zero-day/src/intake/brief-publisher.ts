import { Redis } from 'ioredis';

// ─── Zero-Day → Campaign Event Publisher (Streams) ────────────────────────────
// Publishes `stream:zeroday:briefs` to Redis when an intake session completes.
// Campaign service subscribes using XREADGROUP and triggers execution automatically.
// Constitutional: Article XX — no human wait time in task sequences.

const STREAM_BRIEF_CREATED = 'zeroday:brief.created';

export interface BriefCreatedEvent {
    type: 'brief.created';
    session_id: string;
    client_email: string;
    client_name: string;
    brief_text: string;
    project_type: string;
    budget_range: string;
    timeline: string;
    occured_at: string;
}

/** Singleton Redis publisher for zero-day → campaign auto-chain */
export class BriefPublisher {
    private publisher: Redis | null = null;
    private readonly redisUrl: string;
    private connected = false;

    constructor(redisUrl: string) {
        this.redisUrl = redisUrl;
    }

    connect(): void {
        if (!this.redisUrl) {
            console.log('[ZERO-DAY] Redis not configured — brief.created publisher inactive (auto-chain disabled)');
            return;
        }

        this.publisher = new Redis(this.redisUrl, {
            lazyConnect: true,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 2,
        });

        this.publisher.on('connect', () => {
            this.connected = true;
            console.log('[ZERO-DAY] 📡 Redis publisher connected — auto-chain active');
        });

        this.publisher.on('error', (err: Error) => {
            this.connected = false;
            console.warn('[ZERO-DAY] Redis publisher error (non-fatal — auto-chain paused):', err.message);
        });

        this.publisher.connect().catch((err: Error) => {
            console.warn('[ZERO-DAY] Redis initial connect failed (non-fatal):', err.message);
        });
    }

    /**
     * Publish a brief.created event to trigger campaign auto-execution.
     * Silently no-ops if Redis is not configured or offline.
     */
    async publish(event: Omit<BriefCreatedEvent, 'type' | 'occured_at'>): Promise<void> {
        if (!this.publisher || !this.connected) return;

        const payload: BriefCreatedEvent = {
            type: 'brief.created',
            ...event,
            occured_at: new Date().toISOString(),
        };

        try {
            const messageId = await this.publisher.xadd(
                STREAM_BRIEF_CREATED,
                '*',
                'payload',
                JSON.stringify(payload)
            );
            console.log(`[ZERO-DAY] 📤 brief.created stream message sent | session: ${event.session_id} | msg_id: ${messageId}`);
        } catch (err) {
            console.warn('[ZERO-DAY] Failed to publish brief.created to stream (non-fatal):', (err as Error).message);
        }
    }

    async disconnect(): Promise<void> {
        if (this.publisher) {
            await this.publisher.quit();
            this.publisher = null;
            this.connected = false;
        }
    }
}
