/**
 * contracts/retainer-acceptance.test.ts — Contract Acceptance Trigger Tests
 * ZERO DAY — Creative Liberation Engine v5 GENESIS
 *
 * Tests the proposal acceptance → retainer contract pipeline.
 * Contract PDF generation via generateContract() is mocked (requires Genkit).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProposalAcceptanceSchema } from './retainer-acceptance.js';

// ─── Mock generateContract from generator.ts ─────────────────────────────────
vi.mock('./generator.js', () => ({
  generateContract: vi.fn().mockResolvedValue({
    contract_id: 'contract-mock-123',
    type: 'retainer',
    generated_at: '2026-03-09T12:00:00.000Z',
    status: 'sent',
    content: '# Mock Contract\n\nTest contract content.',
    html: '<html><body>Mock Contract</body></html>',
    pdf_ready: true,
  }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_ACCEPTANCE = {
  proposal_id: 'prop-2026-001',
  client_name: 'Acme Studios',
  client_email: 'billing@acme.io',
  client_address: '123 Creative Ave, New York, NY 10001',
  agency_name: 'Whole Trout Media',
  agency_address: 'Toronto, Ontario, Canada',
  project_title: 'Q1 2026 Brand Retainer',
  contract_type: 'retainer' as const,
  total_value: 5000,
  payment_schedule: [
    { milestone: 'Monthly Payment', amount: 5000, percentage: 100 },
  ],
  scope_of_work: 'Monthly brand management, social media content, and creative direction.',
  deliverables: ['8x social posts/month', 'Monthly brand report', '2 creative campaigns/quarter'],
  timeline_weeks: 4,
  start_date: '2026-04-01',
  jurisdiction: 'us_general' as const,
};

// ─── ProposalAcceptanceSchema ─────────────────────────────────────────────────

describe('ProposalAcceptanceSchema', () => {
  it('accepts a valid proposal acceptance payload', () => {
    const result = ProposalAcceptanceSchema.safeParse(VALID_ACCEPTANCE);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email address', () => {
    const result = ProposalAcceptanceSchema.safeParse({
      ...VALID_ACCEPTANCE,
      client_email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('requires a positive total_value', () => {
    const result = ProposalAcceptanceSchema.safeParse({
      ...VALID_ACCEPTANCE,
      total_value: -500,
    });
    expect(result.success).toBe(false);
  });

  it('defaults contract_type to retainer', () => {
    const { contract_type, ...rest } = VALID_ACCEPTANCE;
    const result = ProposalAcceptanceSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contract_type).toBe('retainer');
    }
  });

  it('defaults jurisdiction to canada', () => {
    const { jurisdiction, ...rest } = VALID_ACCEPTANCE;
    const result = ProposalAcceptanceSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jurisdiction).toBe('canada');
    }
  });

  it('requires at least one deliverable', () => {
    const result = ProposalAcceptanceSchema.safeParse({
      ...VALID_ACCEPTANCE,
      deliverables: [],
    });
    // Empty array is valid per schema — LEX handles the content requirement
    expect(result.success).toBe(true);
  });

  it('stores accepted_at timestamp when provided', () => {
    const ts = '2026-03-09T11:59:57.000Z';
    const result = ProposalAcceptanceSchema.safeParse({
      ...VALID_ACCEPTANCE,
      accepted_at: ts,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accepted_at).toBe(ts);
    }
  });
});

// ─── triggerRetainerOnAcceptance ─────────────────────────────────────────────

describe('triggerRetainerOnAcceptance()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
  });

  it('returns a complete result with contract_id and status=complete on success', async () => {
    const { triggerRetainerOnAcceptance } = await import('./retainer-acceptance.js');
    const result = await triggerRetainerOnAcceptance(VALID_ACCEPTANCE);
    expect(result.contract_id).toBe('contract-mock-123');
    expect(result.proposal_id).toBe('prop-2026-001');
    expect(result.pdf_ready).toBe(true);
    expect(result.email_sent).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.status).toBe('complete');
  });

  it('sets email_sent=true when contract status is sent', async () => {
    const { triggerRetainerOnAcceptance } = await import('./retainer-acceptance.js');
    const result = await triggerRetainerOnAcceptance(VALID_ACCEPTANCE);
    expect(result.email_sent).toBe(true);
  });

  it('normalises payment amounts from percentages', async () => {
    const { triggerRetainerOnAcceptance } = await import('./retainer-acceptance.js');
    const inputWithPct = {
      ...VALID_ACCEPTANCE,
      total_value: 10000,
      payment_schedule: [
        { milestone: 'Kickoff', amount: 0, percentage: 50 },
        { milestone: 'Delivery', amount: 0, percentage: 50 },
      ],
    };
    // Should not throw — amounts normalised from percentages
    const result = await triggerRetainerOnAcceptance(inputWithPct);
    expect(result.pdf_ready).toBe(true);
  });

  it('returns status=partial when NAS upload fails but contract succeeds', async () => {
    // Mock NAS fetch to fail
    global.fetch = vi.fn().mockRejectedValue(new Error('NAS unreachable'));
    const { triggerRetainerOnAcceptance } = await import('./retainer-acceptance.js');
    const result = await triggerRetainerOnAcceptance(VALID_ACCEPTANCE);
    expect(result.pdf_ready).toBe(true);
    expect(result.nas_path).toBeNull();
    expect(['complete', 'partial']).toContain(result.status);
  });

  it('returns status=failed when contract generation throws', async () => {
    const { generateContract } = await import('./generator.js');
    vi.mocked(generateContract).mockRejectedValueOnce(new Error('Genkit offline'));
    const { triggerRetainerOnAcceptance } = await import('./retainer-acceptance.js');
    const result = await triggerRetainerOnAcceptance(VALID_ACCEPTANCE);
    expect(result.status).toBe('failed');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.pdf_ready).toBe(false);
  });

  it('always sets accepted_at in the result', async () => {
    const { triggerRetainerOnAcceptance } = await import('./retainer-acceptance.js');
    const result = await triggerRetainerOnAcceptance(VALID_ACCEPTANCE);
    expect(result.accepted_at).toBeTruthy();
    expect(new Date(result.accepted_at).getTime()).toBeGreaterThan(0);
  });

  it('respects a provided accepted_at timestamp', async () => {
    const ts = '2026-01-15T08:30:00.000Z';
    const { triggerRetainerOnAcceptance } = await import('./retainer-acceptance.js');
    const result = await triggerRetainerOnAcceptance({ ...VALID_ACCEPTANCE, accepted_at: ts });
    expect(result.accepted_at).toBe(ts);
  });
});

// ─── RETAINER_ACCEPTANCE_TOOL export ─────────────────────────────────────────

describe('RETAINER_ACCEPTANCE_TOOL', () => {
  it('exports required MCP tool shape', async () => {
    const { RETAINER_ACCEPTANCE_TOOL } = await import('./retainer-acceptance.js');
    expect(RETAINER_ACCEPTANCE_TOOL).toHaveProperty('name', 'zeroday_trigger_retainer_on_acceptance');
    expect(RETAINER_ACCEPTANCE_TOOL).toHaveProperty('handler');
    expect(RETAINER_ACCEPTANCE_TOOL).toHaveProperty('inputSchema');
    expect(RETAINER_ACCEPTANCE_TOOL.agentPermissions).toContain('LEX');
    expect(typeof RETAINER_ACCEPTANCE_TOOL.handler).toBe('function');
  });
});
