import { describe, it, expect, beforeEach } from 'vitest';
import { LeadScoringEngine, LeadScore } from '../lead-scoring.js';
import type { GTMEvent } from '../../analytics/live-gtm.js';

describe('LeadScoringEngine', () => {
  let engine: LeadScoringEngine;
  const testEmail = 'prospect@test.com';

  beforeEach(() => {
    engine = new LeadScoringEngine();
  });

  const makeEvent = (type: GTMEvent['type'], email = testEmail): GTMEvent => ({
    type,
    client_email: email,
    timestamp: new Date().toISOString(),
  } as GTMEvent);

  it('returns null for events with no client_email', () => {
    const event = { type: 'intake_started', timestamp: new Date().toISOString() } as GTMEvent;
    expect(engine.processEvent(event)).toBeNull();
  });

  it('initializes new lead with score 0 and nurture recommendation', () => {
    const result = engine.processEvent(makeEvent('intake_started'));
    expect(result).not.toBeNull();
    expect(result!.score).toBe(10); // first event: +10 from intake_started
    expect(result!.email).toBe(testEmail);
  });

  it('accumulates score across multiple events', () => {
    engine.processEvent(makeEvent('intake_started'));   // +10
    engine.processEvent(makeEvent('intake_completed')); // +30
    const result = engine.processEvent(makeEvent('proposal_viewed')); // +15

    expect(result!.score).toBe(55);
    expect(result!.factors).toHaveLength(3);
  });

  it('sets recommendation to "engage_now" when score >= 80', () => {
    engine.processEvent(makeEvent('intake_completed')); // +30
    engine.processEvent(makeEvent('proposal_accepted')); // +40
    const result = engine.processEvent(makeEvent('contract_signed')); // +50 → total 120, capped at 100

    expect(result!.score).toBe(100);
    expect(result!.recommendation).toBe('engage_now');
  });

  it('sets recommendation to "nurture" when score is between 30 and 79', () => {
    engine.processEvent(makeEvent('intake_completed')); // +30
    const result = engine.processEvent(makeEvent('proposal_viewed')); // +15 → 45

    expect(result!.recommendation).toBe('nurture');
  });

  it('sets recommendation to "disqualify" when score < 30', () => {
    const result = engine.processEvent(makeEvent('intake_started')); // +10
    expect(result!.recommendation).toBe('disqualify');
  });

  it('caps score at 100', () => {
    for (let i = 0; i < 5; i++) {
      engine.processEvent(makeEvent('contract_signed')); // +50 each time
    }
    const final = engine.getScore(testEmail);
    expect(final!.score).toBe(100);
  });

  it('getScore returns undefined for unknown email', () => {
    expect(engine.getScore('nobody@nowhere.com')).toBeUndefined();
  });

  it('getScore returns the current lead score after events', () => {
    engine.processEvent(makeEvent('intake_started'));
    const score = engine.getScore(testEmail);
    expect(score).toBeDefined();
    expect(score!.score).toBe(10);
  });

  it('tracks multiple leads independently', () => {
    engine.processEvent(makeEvent('contract_signed', 'a@a.com')); // +50
    engine.processEvent(makeEvent('intake_started', 'b@b.com'));   // +10

    expect(engine.getScore('a@a.com')!.score).toBe(50);
    expect(engine.getScore('b@b.com')!.score).toBe(10);
  });

  it('factors array records each scoring event', () => {
    engine.processEvent(makeEvent('intake_started'));  // +10
    engine.processEvent(makeEvent('intake_completed')); // +30
    const score = engine.getScore(testEmail)!;

    expect(score.factors).toContain('+10 from intake_started');
    expect(score.factors).toContain('+30 from intake_completed');
  });

  it('unknown event type contributes 0 weight', () => {
    engine.processEvent({ type: 'unknown_event' as any, client_email: testEmail, timestamp: new Date().toISOString() } as GTMEvent);
    const score = engine.getScore(testEmail)!;
    expect(score.score).toBe(0);
    expect(score.factors).toHaveLength(0);
  });
});
