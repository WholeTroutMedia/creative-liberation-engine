import { PostHog } from 'posthog-node';

// ─── ZERO DAY — PostHog Analytics Tracker ─────────────────────────────────────
// Handles backend event tracking for business metrics (projects, revenue, clients)

const posthogClient = new PostHog(process.env.POSTHOG_API_KEY || 'phc_unconfigured', {
    host: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com'
});

export const trackEvent = (
    client_id: string,
    event_name: string,
    properties?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
) => {
    // Only flush/send if we have a real key (don't fail loudly on dev)
    if (!process.env.POSTHOG_API_KEY) {
        // console.warn(`[ZERO-DAY] PostHog disabled: Event ${event_name} dropped.`);
        return;
    }

    posthogClient.capture({
        distinctId: client_id,
        event: event_name,
        properties: properties,
    });
};

export const shutdownPostHog = async () => {
    await posthogClient.shutdown();
};
