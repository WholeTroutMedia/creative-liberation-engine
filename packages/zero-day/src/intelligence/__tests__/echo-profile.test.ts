import { describe, it, expect, beforeEach } from 'vitest';
import {
  ECHOProfileStore,
  createDefaultProfile,
  recordSignal,
  generateECHOInsights,
  ClientIntelligence,
} from '../echo-profile.js';

// ─── createDefaultProfile ─────────────────────────────────────────────────────

describe('createDefaultProfile', () => {
  it('creates a profile with sensible defaults', () => {
    const p = createDefaultProfile('c-001', 'alice@example.com', 'Alice');
    expect(p.client_id).toBe('c-001');
    expect(p.client_email).toBe('alice@example.com');
    expect(p.client_name).toBe('Alice');
    expect(p.communication_style).toBe('detailed');
    expect(p.approval_speed).toBe('within_2_days');
    expect(p.relationship_health).toBe('neutral');
    expect(p.satisfaction_score).toBe(0.5);
    expect(p.total_projects).toBe(0);
    expect(p.profile_version).toBe(1);
    expect(p.revision_patterns).toHaveLength(0);
    expect(p.satisfaction_signals).toHaveLength(0);
  });

  it('sets working-hours contact time by default', () => {
    const p = createDefaultProfile('c-002', 'bob@example.com', 'Bob');
    expect(p.preferences.contact_time.hours_start).toBe(9);
    expect(p.preferences.contact_time.hours_end).toBe(17);
    expect(p.preferences.contact_time.days).toContain('monday');
    expect(p.preferences.contact_time.days).not.toContain('saturday');
  });

  it('is validated by ClientIntelligenceSchema (no throw)', () => {
    expect(() => createDefaultProfile('c-003', 'carol@ex.com', 'Carol')).not.toThrow();
  });
});

// ─── recordSignal ─────────────────────────────────────────────────────────────

describe('recordSignal', () => {
  let profile: ClientIntelligence;

  beforeEach(() => {
    profile = createDefaultProfile('c-100', 'test@x.com', 'Test Client');
  });

  it('appends a satisfaction signal', () => {
    const updated = recordSignal(profile, 'approval_rate', 0.9);
    expect(updated.satisfaction_signals).toHaveLength(1);
    expect(updated.satisfaction_signals[0].signal_type).toBe('approval_rate');
    expect(updated.satisfaction_signals[0].value).toBe(0.9);
  });

  it('recalculates satisfaction_score as average', () => {
    let p = recordSignal(profile, 'approval_rate', 0.8);
    p = recordSignal(p, 'response_speed', 0.6);
    // avg = 0.7
    expect(p.satisfaction_score).toBeCloseTo(0.7, 2);
  });

  it('sets relationship_health to "excellent" when avg >= 0.85', () => {
    const updated = recordSignal(profile, 'referral_sent', 1.0);
    expect(updated.relationship_health).toBe('excellent');
  });

  it('sets relationship_health to "healthy" when avg 0.65-0.84', () => {
    const updated = recordSignal(profile, 'approval_rate', 0.75);
    expect(updated.relationship_health).toBe('healthy');
  });

  it('sets relationship_health to "at_risk" when avg < 0.4', () => {
    const updated = recordSignal(profile, 'communication_tone', 0.2);
    expect(updated.relationship_health).toBe('at_risk');
  });

  it('computes nps_estimate as scaled satisfaction', () => {
    const updated = recordSignal(profile, 'approval_rate', 1.0); // avg=1 → nps=100
    expect(updated.nps_estimate).toBe(100);
  });

  it('sets upsell_readiness when satisfaction >= 0.75 and >= 1 project', () => {
    const withProject = { ...profile, total_projects: 2 };
    const updated = recordSignal(withProject, 'repeat_project', 0.9);
    expect(updated.upsell_readiness).toBe(true);
  });

  it('does NOT set upsell_readiness with 0 projects even if high satisfaction', () => {
    const updated = recordSignal(profile, 'referral_sent', 0.9);
    expect(updated.upsell_readiness).toBe(false);
  });

  it('sets referral_probability to 0.7 when avg >= 0.85', () => {
    const updated = recordSignal(profile, 'referral_sent', 1.0);
    expect(updated.referral_probability).toBe(0.7);
  });

  it('accumulates up to 50 signals and trims older ones', () => {
    let p = profile;
    for (let i = 0; i < 55; i++) {
      p = recordSignal(p, 'response_speed', 0.8);
    }
    expect(p.satisfaction_signals).toHaveLength(50);
  });

  it('attaches note and project_id when provided', () => {
    const updated = recordSignal(profile, 'scope_increase', 0.6, 'scope up', 'proj-42');
    expect(updated.satisfaction_signals[0].note).toBe('scope up');
    expect(updated.satisfaction_signals[0].project_id).toBe('proj-42');
  });

  it('sets churn_risk = "high" when satisfaction < 0.35', () => {
    const updated = recordSignal(profile, 'communication_tone', 0.1);
    expect(updated.churn_risk).toBe('high');
  });

  it('sets churn_risk = "medium" when satisfaction 0.35–0.54', () => {
    const updated = recordSignal(profile, 'communication_tone', 0.45);
    expect(updated.churn_risk).toBe('medium');
  });
});

// ─── generateECHOInsights ─────────────────────────────────────────────────────

describe('generateECHOInsights', () => {
  it('returns churn alert for at-risk client', () => {
    const p = createDefaultProfile('c-200', 'x@x.com', 'X Co');
    const atRisk: ClientIntelligence = { ...p, churn_risk: 'high' };
    const insights = generateECHOInsights(atRisk);
    expect(insights.some((i) => i.includes('CHURN RISK'))).toBe(true);
  });

  it('returns upsell hint when ready and opportunities exist', () => {
    const p = createDefaultProfile('c-201', 'y@y.com', 'Y Co');
    const ready: ClientIntelligence = {
      ...p,
      upsell_readiness: true,
      upsell_opportunities: ['Annual retainer upgrade'],
    };
    const insights = generateECHOInsights(ready);
    expect(insights.some((i) => i.includes('UPSELL'))).toBe(true);
    expect(insights.some((i) => i.includes('Annual retainer upgrade'))).toBe(true);
  });

  it('returns referral hint when referral_probability >= 0.6', () => {
    const p = createDefaultProfile('c-202', 'z@z.com', 'Z Co');
    const referral: ClientIntelligence = { ...p, referral_probability: 0.7 };
    const insights = generateECHOInsights(referral);
    expect(insights.some((i) => i.includes('REFERRAL'))).toBe(true);
  });

  it('returns payment warning for always_late payer', () => {
    const p = createDefaultProfile('c-203', 'a@a.com', 'A Co');
    const late: ClientIntelligence = { ...p, payment_reliability: 'always_late' };
    const insights = generateECHOInsights(late);
    expect(insights.some((i) => i.includes('PAYMENT'))).toBe(true);
  });

  it('returns revision pattern alert when frequency >= 7', () => {
    const p = createDefaultProfile('c-204', 'b@b.com', 'B Co');
    const withRevisions: ClientIntelligence = {
      ...p,
      revision_patterns: [{ category: 'copy', frequency: 8, typical_feedback: 'needs more punch' }],
    };
    const insights = generateECHOInsights(withRevisions);
    expect(insights.some((i) => i.includes('REVISION PATTERN'))).toBe(true);
  });

  it('returns timeline warning for slow approvers', () => {
    const p = createDefaultProfile('c-205', 'c@c.com', 'C Co');
    const slow: ClientIntelligence = { ...p, approval_speed: 'slow' };
    const insights = generateECHOInsights(slow);
    expect(insights.some((i) => i.includes('TIMELINE'))).toBe(true);
  });

  it('returns empty array for a perfectly healthy client', () => {
    const p = createDefaultProfile('c-206', 'd@d.com', 'D Co');
    expect(generateECHOInsights(p)).toHaveLength(0);
  });
});

// ─── ECHOProfileStore ─────────────────────────────────────────────────────────

describe('ECHOProfileStore', () => {
  let store: ECHOProfileStore;

  beforeEach(() => {
    store = new ECHOProfileStore();
  });

  it('returns null for unknown client', async () => {
    expect(await store.get('nobody')).toBeNull();
  });

  it('saves and retrieves a profile', async () => {
    const p = createDefaultProfile('c-300', 'e@e.com', 'E Co');
    await store.save(p);
    const result = await store.get('c-300');
    expect(result).toBeDefined();
    expect(result!.client_name).toBe('E Co');
  });

  it('getOrCreate creates a fresh profile for new client', async () => {
    const p = await store.getOrCreate('c-301', 'f@f.com', 'F Co');
    expect(p.client_id).toBe('c-301');
    expect(p.total_projects).toBe(0);
  });

  it('getOrCreate returns existing profile for known client', async () => {
    const first = await store.getOrCreate('c-302', 'g@g.com', 'G Co');
    const second = await store.getOrCreate('c-302', 'g@g.com', 'G Co');
    expect(first).toEqual(second);
  });

  it('recordProjectComplete increments total_projects and lifetime_value', async () => {
    await store.getOrCreate('c-303', 'h@h.com', 'H Co');
    const updated = await store.recordProjectComplete('c-303', 'proj-x', 5000);
    expect(updated.total_projects).toBe(1);
    expect(updated.lifetime_value).toBe(5000);
    expect(updated.project_ids).toContain('proj-x');
  });

  it('recordProjectComplete computes average_project_value correctly', async () => {
    await store.getOrCreate('c-304', 'i@i.com', 'I Co');
    await store.recordProjectComplete('c-304', 'p1', 4000);
    const updated = await store.recordProjectComplete('c-304', 'p2', 6000);
    // (4000 + 6000) / 2 = 5000
    expect(updated.average_project_value).toBe(5000);
  });

  it('recordProjectComplete throws for unknown client', async () => {
    await expect(store.recordProjectComplete('ghost', 'px', 100)).rejects.toThrow('Client ghost not found');
  });

  it('getInsights returns insights for a stored client', async () => {
    await store.getOrCreate('c-305', 'j@j.com', 'J Co');
    // No concerning signals yet → empty insights
    const insights = store.getInsights('c-305');
    expect(Array.isArray(insights)).toBe(true);
  });

  it('getInsights returns empty array for unknown client', () => {
    expect(store.getInsights('nobody')).toHaveLength(0);
  });
});
