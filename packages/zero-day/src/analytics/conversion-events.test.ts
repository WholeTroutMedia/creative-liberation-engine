/**
 * conversion-events.test.ts — ZeroDayConversionEvent Schema + Capture Functions
 * ZERO DAY — Creative Liberation Engine v5.0.0 (GENESIS) — T20260309-651
 *
 * Tests the full landing page analytics pipeline:
 *   - ZeroDayConversionEvent schema validation
 *   - captureCtaClick, captureEmailSubmit, captureFormComplete, capturePartnerInquiry
 *   - validateConversionEvents batch utility
 *   - PostHog capture interception (mocked)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock posthog.ts (no real API calls in tests) ────────────────────────────
vi.mock('./posthog.js', () => ({
  trackEvent: vi.fn(),
  shutdownPostHog: vi.fn().mockResolvedValue(undefined),
}));

import {
  ZeroDayConversionEvent,
  ConversionEventType,
  captureCtaClick,
  captureEmailSubmit,
  captureFormComplete,
  capturePartnerInquiry,
  captureDemoRequest,
  validateConversionEvents,
} from './conversion-events.js';
import { trackEvent } from './posthog.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VISITOR_ID = 'vis_test_abc123';
const TEST_EMAIL = 'inquiries@creativeliberationengine.org';

// ─── ZeroDayConversionEvent Schema ───────────────────────────────────────────

describe('ZeroDayConversionEvent schema', () => {
  it('accepts a minimal valid event', () => {
    const result = ZeroDayConversionEvent.safeParse({
      visitor_id: VISITOR_ID,
      event_type: 'cta_click',
    });
    expect(result.success).toBe(true);
  });

  it('defaults occurred_at to current ISO timestamp', () => {
    const before = Date.now();
    const result = ZeroDayConversionEvent.safeParse({
      visitor_id: VISITOR_ID,
      event_type: 'email_submit',
    });
    const after = Date.now();
    expect(result.success).toBe(true);
    if (result.success) {
      const ts = new Date(result.data.occurred_at).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    }
  });

  it('defaults metadata to empty object', () => {
    const result = ZeroDayConversionEvent.safeParse({
      visitor_id: VISITOR_ID,
      event_type: 'form_complete',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toEqual({});
    }
  });

  it('rejects an empty visitor_id', () => {
    const result = ZeroDayConversionEvent.safeParse({
      visitor_id: '',
      event_type: 'cta_click',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown event_type', () => {
    const result = ZeroDayConversionEvent.safeParse({
      visitor_id: VISITOR_ID,
      event_type: 'unknown_event',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email on email_submit event', () => {
    const result = ZeroDayConversionEvent.safeParse({
      visitor_id: VISITOR_ID,
      event_type: 'email_submit',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid ConversionEventType values', () => {
    const types = ConversionEventType.options;
    expect(types.length).toBeGreaterThan(0);
    for (const t of types) {
      const result = ZeroDayConversionEvent.safeParse({ visitor_id: VISITOR_ID, event_type: t });
      expect(result.success).toBe(true);
    }
  });

  it('stores UTM params when provided', () => {
    const result = ZeroDayConversionEvent.safeParse({
      visitor_id: VISITOR_ID,
      event_type: 'cta_click',
      utm_source: 'twitter',
      utm_medium: 'social',
      utm_campaign: 'launch',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.utm_source).toBe('twitter');
      expect(result.data.utm_medium).toBe('social');
      expect(result.data.utm_campaign).toBe('launch');
    }
  });
});

// ─── captureCtaClick ─────────────────────────────────────────────────────────

describe('captureCtaClick()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls trackEvent with zero_day_cta_click', () => {
    captureCtaClick(VISITOR_ID, 'hero-cta-btn');
    expect(trackEvent).toHaveBeenCalledOnce();
    expect(trackEvent).toHaveBeenCalledWith(
      VISITOR_ID,
      'zero_day_cta_click',
      expect.objectContaining({ source_element: 'hero-cta-btn' }),
    );
  });

  it('passes UTM params to trackEvent', () => {
    captureCtaClick(VISITOR_ID, 'nav-join-btn', { source: 'twitter', campaign: 'launch' });
    expect(trackEvent).toHaveBeenCalledWith(
      VISITOR_ID,
      'zero_day_cta_click',
      expect.objectContaining({ utm_source: 'twitter', utm_campaign: 'launch' }),
    );
  });
});

// ─── captureEmailSubmit ───────────────────────────────────────────────────────

describe('captureEmailSubmit()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls trackEvent with zero_day_email_submit', () => {
    captureEmailSubmit(VISITOR_ID, TEST_EMAIL);
    expect(trackEvent).toHaveBeenCalledOnce();
    expect(trackEvent).toHaveBeenCalledWith(
      VISITOR_ID,
      'zero_day_email_submit',
      expect.objectContaining({ email_domain: 'cleengine.systems' }),
    );
  });

  it('does NOT include full email address in PostHog properties (PII guard)', () => {
    captureEmailSubmit(VISITOR_ID, TEST_EMAIL);
    const [, , props] = vi.mocked(trackEvent).mock.calls[0]!;
    expect(JSON.stringify(props)).not.toContain(TEST_EMAIL);
    expect(JSON.stringify(props)).toContain('cleengine.systems');
  });
});

// ─── captureFormComplete ──────────────────────────────────────────────────────

describe('captureFormComplete()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls trackEvent with zero_day_form_complete', () => {
    captureFormComplete(VISITOR_ID, 'studio');
    expect(trackEvent).toHaveBeenCalledWith(
      VISITOR_ID,
      'zero_day_form_complete',
      expect.objectContaining({ inquiry_tier: 'studio' }),
    );
  });

  it('merges metadata into PostHog properties', () => {
    captureFormComplete(VISITOR_ID, 'enterprise', { budget: '$50k+' });
    const [, , props] = vi.mocked(trackEvent).mock.calls[0]!;
    expect(props).toHaveProperty('budget', '$50k+');
    expect(props).toHaveProperty('inquiry_tier', 'enterprise');
  });
});

// ─── capturePartnerInquiry ────────────────────────────────────────────────────

describe('capturePartnerInquiry()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls trackEvent with zero_day_partner_inquiry', () => {
    capturePartnerInquiry(VISITOR_ID, 'partner');
    expect(trackEvent).toHaveBeenCalledWith(
      VISITOR_ID,
      'zero_day_partner_inquiry',
      expect.objectContaining({ inquiry_tier: 'partner' }),
    );
  });
});

// ─── captureDemoRequest ───────────────────────────────────────────────────────

describe('captureDemoRequest()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls trackEvent with zero_day_demo_requested', () => {
    captureDemoRequest(VISITOR_ID, 'features-section');
    expect(trackEvent).toHaveBeenCalledWith(
      VISITOR_ID,
      'zero_day_demo_requested',
      expect.objectContaining({ source_element: 'features-section' }),
    );
  });
});

// ─── validateConversionEvents ─────────────────────────────────────────────────

describe('validateConversionEvents()', () => {
  it('separates valid from invalid events', () => {
    const raw = [
      { visitor_id: VISITOR_ID, event_type: 'cta_click' },
      { visitor_id: '', event_type: 'cta_click' }, // invalid: empty visitor_id
      null,                                          // invalid: not an object
      { visitor_id: 'v2', event_type: 'email_submit', email: TEST_EMAIL },
    ];

    const { valid, errors } = validateConversionEvents(raw);
    expect(valid.length).toBe(2);
    expect(errors.length).toBe(2);
    expect(errors[0]!.index).toBe(1);
    expect(errors[1]!.index).toBe(2);
  });

  it('returns empty arrays for empty input', () => {
    const { valid, errors } = validateConversionEvents([]);
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('valid events have correct occurred_at timestamps', () => {
    const { valid } = validateConversionEvents([
      { visitor_id: VISITOR_ID, event_type: 'pricing_viewed' },
    ]);
    expect(valid.length).toBe(1);
    expect(new Date(valid[0]!.occurred_at).getTime()).toBeGreaterThan(0);
  });
});
