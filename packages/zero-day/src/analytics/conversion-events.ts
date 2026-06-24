/**
 * Zero-Day — Landing Intelligence: Conversion Event Schema
 * Creative Liberation Engine v5.0.0 (GENESIS) — T20260309-651
 *
 * Defines the ZeroDayConversionEvent TypeScript schema and wires PostHog capture
 * calls at every landing funnel touchpoint:
 *   - CTA click
 *   - Email submit
 *   - Form complete
 *   - Partner inquiry
 *
 * Article IX: Strict types, no any, full PostHog integration.
 */

import { z } from 'zod';
import { trackEvent } from './posthog.js';

// ─── Conversion Event Types ────────────────────────────────────────────────────

export const ConversionEventType = z.enum([
  'cta_click',
  'email_submit',
  'form_complete',
  'partner_inquiry',
  'demo_requested',
  'pricing_viewed',
  'contact_opened',
]);

export type ConversionEventType = z.infer<typeof ConversionEventType>;

// ─── ZeroDayConversionEvent Schema ────────────────────────────────────────────

export const ZeroDayConversionEvent = z.object({
  /** Unique anonymous visitor ID (from analytics cookie / session) */
  visitor_id: z.string().min(1),

  /** The specific funnel action that triggered this event */
  event_type: ConversionEventType,

  /** ISO 8601 timestamp of the event */
  occurred_at: z.string().datetime().default(() => new Date().toISOString()),

  /** Which CTA / button / section triggered this */
  source_element: z.string().optional(),

  /** UTM source (from URL query params) */
  utm_source: z.string().optional(),

  /** UTM medium */
  utm_medium: z.string().optional(),

  /** UTM campaign */
  utm_campaign: z.string().optional(),

  /** URL of the page where the event occurred */
  page_url: z.string().url().optional(),

  /** Email address if provided (only on form submit events) */
  email: z.string().email().optional(),

  /** Inquiry tier: 'solo' | 'studio' | 'enterprise' | 'partner' */
  inquiry_tier: z.enum(['solo', 'studio', 'enterprise', 'partner']).optional(),

  /** Free-form metadata for event-specific context */
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type ZeroDayConversionEvent = z.infer<typeof ZeroDayConversionEvent>;

// ─── Capture Functions ─────────────────────────────────────────────────────────

/**
 * Track a CTA button click on the Zero-Day landing page.
 */
export function captureCtaClick(
  visitorId: string,
  sourceElement: string,
  utmParams: { source?: string; medium?: string; campaign?: string } = {},
  pageUrl?: string,
): void {
  const event = ZeroDayConversionEvent.parse({
    visitor_id: visitorId,
    event_type: 'cta_click',
    source_element: sourceElement,
    utm_source: utmParams.source,
    utm_medium: utmParams.medium,
    utm_campaign: utmParams.campaign,
    page_url: pageUrl,
  });

  trackEvent(event.visitor_id, 'zero_day_cta_click', {
    source_element: event.source_element,
    utm_source: event.utm_source,
    utm_medium: event.utm_medium,
    utm_campaign: event.utm_campaign,
    page_url: event.page_url,
    occurred_at: event.occurred_at,
  });
}

/**
 * Track an email submission on the landing page.
 */
export function captureEmailSubmit(
  visitorId: string,
  email: string,
  sourceElement?: string,
  utmParams: { source?: string; medium?: string; campaign?: string } = {},
): void {
  const event = ZeroDayConversionEvent.parse({
    visitor_id: visitorId,
    event_type: 'email_submit',
    email,
    source_element: sourceElement,
    utm_source: utmParams.source,
    utm_medium: utmParams.medium,
    utm_campaign: utmParams.campaign,
  });

  trackEvent(event.visitor_id, 'zero_day_email_submit', {
    email_domain: email.split('@')[1], // Don't send PII; only domain
    source_element: event.source_element,
    utm_source: event.utm_source,
    utm_medium: event.utm_medium,
    utm_campaign: event.utm_campaign,
    occurred_at: event.occurred_at,
  });
}

/**
 * Track a completed intake form submission.
 */
export function captureFormComplete(
  visitorId: string,
  tier: ZeroDayConversionEvent['inquiry_tier'],
  metadata: Record<string, unknown> = {},
): void {
  const event = ZeroDayConversionEvent.parse({
    visitor_id: visitorId,
    event_type: 'form_complete',
    inquiry_tier: tier,
    metadata,
  });

  trackEvent(event.visitor_id, 'zero_day_form_complete', {
    inquiry_tier: event.inquiry_tier,
    occurred_at: event.occurred_at,
    ...event.metadata,
  });
}

/**
 * Track a partner inquiry submission.
 */
export function capturePartnerInquiry(
  visitorId: string,
  tier: 'partner' | 'enterprise',
  metadata: Record<string, unknown> = {},
): void {
  const event = ZeroDayConversionEvent.parse({
    visitor_id: visitorId,
    event_type: 'partner_inquiry',
    inquiry_tier: tier,
    metadata,
  });

  trackEvent(event.visitor_id, 'zero_day_partner_inquiry', {
    inquiry_tier: event.inquiry_tier,
    occurred_at: event.occurred_at,
    ...event.metadata,
  });
}

/**
 * Track a demo request.
 */
export function captureDemoRequest(
  visitorId: string,
  sourceElement?: string,
  metadata: Record<string, unknown> = {},
): void {
  const event = ZeroDayConversionEvent.parse({
    visitor_id: visitorId,
    event_type: 'demo_requested',
    source_element: sourceElement,
    metadata,
  });

  trackEvent(event.visitor_id, 'zero_day_demo_requested', {
    source_element: event.source_element,
    occurred_at: event.occurred_at,
    ...event.metadata,
  });
}

/**
 * Batch validate an array of raw events against the schema.
 * Returns parsed events and validation errors separately.
 */
export function validateConversionEvents(raw: unknown[]): {
  valid: ZeroDayConversionEvent[];
  errors: Array<{ index: number; error: string }>;
} {
  const valid: ZeroDayConversionEvent[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < raw.length; i++) {
    const result = ZeroDayConversionEvent.safeParse(raw[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push({ index: i, error: result.error.message });
    }
  }

  return { valid, errors };
}
