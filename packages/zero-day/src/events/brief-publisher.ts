import { Redis } from 'ioredis';
import type { IntakeSession } from '../intake/form-engine.js';

// ─── ZERO DAY Event Publisher (Streams) ───────────────────────────────────────
// Publishes domain events to a Redis Stream for durable, guaranteed delivery.
// Campaign service consumes via Consumer Groups — no human required.

export const STREAM_BRIEF_CREATED = 'stream:zeroday:briefs';

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

let publisher: Redis | null = null;

function getPublisher(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null; // Redis optional — graceful degradation
  }
  if (!publisher) {
    publisher = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 2,
    });
    publisher.on('error', (err: Error) => {
      console.warn('[ZERO DAY] Redis publisher error (non-fatal):', err.message);
    });
  }
  return publisher;
}

/**
 * Publish a brief.created event to the Redis Stream when an intake session completes.
 * Fire-and-forget — never blocks the HTTP response.
 */
export async function publishBriefCreated(session: IntakeSession): Promise<void> {
  const pub = getPublisher();
  if (!pub) {
    console.log('[ZERO DAY] Redis not configured — skipping brief.created stream event');
    return;
  }

  const intent = session.current_intent;
  const event: BriefCreatedEvent = {
    type: 'brief.created',
    session_id: session.session_id,
    client_email: session.client_email,
    client_name: session.client_name,
    brief_text: session.generated_brief ?? '',
    project_type: intent?.project_type ?? 'other',
    budget_range: intent?.budget_range ?? 'to_be_discussed',
    timeline: intent?.timeline ?? 'flexible',
    occured_at: new Date().toISOString(),
  };

  try {
    // XADD <key> * <field> <value>
    // * means Redis generates the ID (timestamp-seq)
    const streamId = await pub.xadd(STREAM_BRIEF_CREATED, '*', 'payload', JSON.stringify(event));
    console.log(`[ZERO DAY] 📡 brief.created appended to stream ${STREAM_BRIEF_CREATED} | id: ${streamId} | session: ${session.session_id}`);
  } catch (err) {
    // Non-fatal — log only, never surface to client
    console.warn('[ZERO DAY] Failed to publish to stream (non-fatal):', (err as Error).message);
  }
}

export async function closePublisher(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
}
