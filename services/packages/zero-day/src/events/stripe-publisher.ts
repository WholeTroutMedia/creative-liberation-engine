import { Redis } from 'ioredis';

// ─── Stripe Event Publisher ───────────────────────────────────────────────────
// Publishes Stripe webhook events to Redis pub/sub channels.
// Allows other services (e.g., campaign) to react to payments without coupling.

export const CHANNEL_STRIPE_PAYMENT_RECEIVED = 'zeroday:stripe.payment_received';

export interface StripePaymentReceivedEvent {
    type: 'stripe.payment_received';
    customer_email: string;
    amount_paid: number;
    invoice_id: string;
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
 * Publish a stripe.payment_received event.
 * Fire-and-forget — never blocks the HTTP response.
 */
export async function publishStripePaymentReceived(
    customer_email: string,
    amount_paid: number,
    invoice_id: string,
): Promise<void> {
    const pub = getPublisher();
    if (!pub) {
        console.log('[ZERO DAY] Redis not configured — skipping stripe.payment_received event');
        return;
    }

    const event: StripePaymentReceivedEvent = {
        type: 'stripe.payment_received',
        customer_email,
        amount_paid,
        invoice_id,
        occured_at: new Date().toISOString(),
    };

    try {
        const subscribers = await pub.publish(CHANNEL_STRIPE_PAYMENT_RECEIVED, JSON.stringify(event));
        console.log(`[ZERO DAY] 📡 stripe.payment_received published → ${subscribers} subscriber(s) | email: ${customer_email}`);
    } catch (err) {
        // Non-fatal — log only, never surface to client
        console.warn('[ZERO DAY] Failed to publish stripe.payment_received (non-fatal):', (err as Error).message);
    }
}

export async function closeStripePublisher(): Promise<void> {
    if (publisher) {
        await publisher.quit();
        publisher = null;
    }
}
