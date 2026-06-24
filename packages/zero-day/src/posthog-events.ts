/**
 * Zero-Day GTM — PostHog Conversion Event Schema
 * Creative Liberation Engine v5.0.0 (GENESIS)
 *
 * All GTM funnel events are sent here. Wire posthog-node for server-side
 * and posthog-js for browser-side (depending on runtime context).
 */

declare const window: any;

// ─── Event Types ──────────────────────────────────────────────────────────────

export type ZeroDayEventName =
  | 'zd_cta_click'
  | 'zd_email_submit'
  | 'zd_form_start'
  | 'zd_form_complete'
  | 'zd_partner_inquiry'
  | 'zd_demo_request'
  | 'zd_pricing_view'
  | 'zd_intake_submit'
  | 'zd_session_start'
  | 'zd_page_view';

export interface ZeroDayBaseProperties {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Page or surface where event fired */
  surface: 'landing' | 'intake_form' | 'client_portal' | 'console' | 'email';
  /** Distinct user/session ID */
  distinct_id: string;
  /** UTM source if present */
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export interface ZeroDayCtaClickProperties extends ZeroDayBaseProperties {
  cta_label: string;
  cta_destination: string;
  position: 'hero' | 'mid' | 'footer' | 'nav' | 'inline';
}

export interface ZeroDayEmailSubmitProperties extends ZeroDayBaseProperties {
  email_domain: string; // domain only, not full email (PII)
  list_id?: string;
}

export interface ZeroDayFormProperties extends ZeroDayBaseProperties {
  form_id: string;
  form_name: string;
  fields_completed?: number;
  fields_total?: number;
}

export interface ZeroDayPartnerInquiryProperties extends ZeroDayBaseProperties {
  partner_type: 'agency' | 'brand' | 'talent' | 'tech' | 'other';
  budget_range?: string;
  service_interest?: string[];
}

export interface ZeroDayPageViewProperties extends ZeroDayBaseProperties {
  path: string;
  referrer?: string;
  title?: string;
}

// ─── Event Registry ───────────────────────────────────────────────────────────

export type ZeroDayEvent =
  | { event: 'zd_cta_click'; properties: ZeroDayCtaClickProperties }
  | { event: 'zd_email_submit'; properties: ZeroDayEmailSubmitProperties }
  | { event: 'zd_form_start'; properties: ZeroDayFormProperties }
  | { event: 'zd_form_complete'; properties: ZeroDayFormProperties }
  | { event: 'zd_partner_inquiry'; properties: ZeroDayPartnerInquiryProperties }
  | { event: 'zd_demo_request'; properties: ZeroDayBaseProperties }
  | { event: 'zd_pricing_view'; properties: ZeroDayBaseProperties }
  | { event: 'zd_intake_submit'; properties: ZeroDayFormProperties }
  | { event: 'zd_session_start'; properties: ZeroDayBaseProperties }
  | { event: 'zd_page_view'; properties: ZeroDayPageViewProperties };

// ─── PostHog Capture Interface ────────────────────────────────────────────────

export interface PostHogCapture {
  capture(event: string, properties?: Record<string, unknown>): void;
}

/**
 * Type-safe wrapper for dispatching Zero-Day GTM events.
 * Pass a posthog instance (browser or server) as the first argument.
 *
 * @example
 * captureZeroDayEvent(posthog, {
 *   event: 'zd_cta_click',
 *   properties: { cta_label: 'Book a Call', cta_destination: '/intake-form', position: 'hero', ... }
 * });
 */
export function captureZeroDayEvent(
  posthog: PostHogCapture,
  payload: ZeroDayEvent,
): void {
  const props = {
    ...payload.properties,
    timestamp: payload.properties.timestamp ?? new Date().toISOString(),
    $source: 'cle-engine-v5',
  };

  posthog.capture(payload.event, props);
}

// ─── Funnel stage helpers ─────────────────────────────────────────────────────

/** Build a base property set from the current browser environment (client-side only). */
export function buildBaseProperties(
  distinctId: string,
  surface: ZeroDayBaseProperties['surface'],
): ZeroDayBaseProperties {
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  return {
    timestamp: new Date().toISOString(),
    surface,
    distinct_id: distinctId,
    utm_source: search?.get('utm_source') ?? undefined,
    utm_medium: search?.get('utm_medium') ?? undefined,
    utm_campaign: search?.get('utm_campaign') ?? undefined,
  };
}

/**
 * Conversion funnel stage labels — use for analytics dashboards.
 */
export const FUNNEL_STAGES = [
  { stage: 1, event: 'zd_page_view', label: 'Awareness' },
  { stage: 2, event: 'zd_cta_click', label: 'Engagement' },
  { stage: 3, event: 'zd_email_submit', label: 'Lead Capture' },
  { stage: 4, event: 'zd_form_start', label: 'Intent Signal' },
  { stage: 5, event: 'zd_intake_submit', label: 'Qualified Lead' },
  { stage: 6, event: 'zd_partner_inquiry', label: 'High-Intent Partner' },
] as const;
