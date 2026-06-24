import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchEmitter } from '../events.js';

describe('DispatchEventBus', () => {
  beforeEach(() => {
    dispatchEmitter.removeAllListeners();
  });

  it('emits task:created to listeners', () => {
    const handler = vi.fn();
    dispatchEmitter.on('task:created', handler);

    dispatchEmitter.emitSafe('task:created', {
      id: 'T20260320-001',
      title: 'Test task',
      workstream: 'general',
      priority: 'P1',
      status: 'queued',
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toMatchObject({
      id: 'T20260320-001',
      title: 'Test task',
    });
  });

  it('emits blocker:filed to listeners', () => {
    const handler = vi.fn();
    dispatchEmitter.on('blocker:filed', handler);

    dispatchEmitter.emitSafe('blocker:filed', {
      id: 'BLK-001',
      severity: 'P0',
      type: 'blocking-deploy',
      description: 'NAS offline',
      filed_by: 'test-agent',
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].severity).toBe('P0');
  });

  it('emits handoff:phase-change to listeners', () => {
    const handler = vi.fn();
    dispatchEmitter.on('handoff:phase-change', handler);

    dispatchEmitter.emitSafe('handoff:phase-change', {
      from: 'NAVD',
      phase: 'PROBE',
      task: 'Research DAW',
      timestamp: new Date().toISOString(),
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].from).toBe('NAVD');
  });

  it('does not throw when listener errors', () => {
    dispatchEmitter.on('task:created', () => {
      throw new Error('Listener boom');
    });

    expect(() => {
      dispatchEmitter.emitSafe('task:created', {
        id: 'T-ERR',
        title: 'Error task',
        status: 'queued',
      });
    }).not.toThrow();
  });

  it('supports multiple listeners on the same event', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    dispatchEmitter.on('task:completed', h1);
    dispatchEmitter.on('task:completed', h2);

    dispatchEmitter.emitSafe('task:completed', {
      id: 'T-DONE',
      title: 'Done task',
      status: 'done',
    });

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });
});
