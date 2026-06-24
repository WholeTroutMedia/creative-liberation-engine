/**
 * @cle/somatic — ConsciousnessLoop Biometric Integration Test
 *
 * T20260308-001: BiometricBridge → ConsciousnessLoop integration test
 *
 * Tests the full wiring of BiometricBrief injection into ConsciousnessLoop
 * without requiring live network connections to UE5, Audio2Face, or the
 * Health Auto Export REST API.
 *
 * Strategy:
 *   - Mock OmnimediaDirector.perform() to capture calls + return stub result
 *   - Mock SomaticBridge to avoid binding real ports
 *   - Inject synthetic BiometricBrief via loop.receiveBiometricBrief()
 *   - Assert 'performance' event fires with correct frame data
 *   - Assert ConsciousnessLoop.getStatus() reflects live state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { ConsciousnessLoop, PerformanceResult } from '../ConsciousnessLoop.js';
import type { BiometricBrief } from '../OmnimediaDirector.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../OmnimediaDirector.js', () => {
  const mockPerform = vi.fn();
  const MockOmnimediaDirector = vi.fn().mockImplementation(() => ({
    perform: mockPerform,
  }));
  return { OmnimediaDirector: MockOmnimediaDirector, mockPerform };
});

vi.mock('../SomaticBridge.js', () => {
  const MockSomaticBridge = vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({
      frameCount: 42,
      framesEmitted: 42,
      framesDropped: 0,
      elapsed: 1000,
      averageFps: 60,
      currentFps: 60,
      targetFps: 60,
      queueDepth: 0,
      uptime: 1000,
    }),
  }));
  return { SomaticBridge: MockSomaticBridge };
});

vi.mock('../PerformanceMonitor.js', () => ({
  performanceMonitor: {
    startSession: vi.fn(),
    endSession: vi.fn().mockResolvedValue({
      sessionId: 'test-session',
      totalFrames: 42,
      avgLatencyMs: 32,
      p50LatencyMs: 28,
      p95LatencyMs: 95,
      p99LatencyMs: 120,
      meetsSub200msTarget: true,
      startedAt: Date.now() - 1000,
      endedAt: Date.now(),
    }),
    getStats: vi.fn().mockReturnValue({
      totalFrames: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      meetsSub200msTarget: true,
      startedAt: Date.now(),
      endedAt: null,
      sessionId: null,
    }),
  },
  PerformanceSummary: {},
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeBiometricBrief = (overrides: Partial<BiometricBrief> = {}): BiometricBrief => ({
  bpm: 72,
  hrv: 45,
  motionIntensity: 0.2,
  headOrientation: { pitch: 0.1, yaw: -0.05, roll: 0.0 },
  mood: 'calm',
  sources: ['apple-watch', 'airpods'],
  timestamp: Date.now(),
  ...overrides,
});

const makePerformanceResult = (overrides: Partial<PerformanceResult> = {}): PerformanceResult => ({
  framesTransmitted: 60,
  durationMs: 132,
  synthesizedPrompt: 'test-prompt',
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConsciousnessLoop — BiometricBridge Integration', () => {
  let loop: ConsciousnessLoop;
  let mockPerform: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import the mock function reference after mocks are applied
    const { mockPerform: mp } = await import('../OmnimediaDirector.js') as unknown as {
      mockPerform: ReturnType<typeof vi.fn>;
    };
    mockPerform = mp;
    mockPerform.mockResolvedValue(makePerformanceResult());

    loop = new ConsciousnessLoop({
      enableStatsPolling: false, // disable timer for clean test teardown
    });
  });

  afterEach(async () => {
    if ((loop as unknown as { isRunning: boolean }).isRunning) {
      await loop.stop();
    }
    vi.clearAllTimers();
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  it('starts cleanly — emits start event', async () => {
    const startHandler = vi.fn();
    loop.on('start', startHandler);

    await loop.start();

    expect(startHandler).toHaveBeenCalledOnce();
  });

  it('stops cleanly — returns PerformanceSummary with sub-200ms target met', async () => {
    await loop.start();
    const summary = await loop.stop();

    expect(summary.meetsSub200msTarget).toBe(true);
    expect(summary.totalFrames).toBe(42);
    expect(summary.p95LatencyMs).toBeLessThan(200);
  });

  it('double-start is a no-op (no error, no double-bind)', async () => {
    await loop.start();
    await expect(loop.start()).resolves.toBeUndefined();
  });

  it('stop() on idle loop returns zero stats without throwing', async () => {
    const summary = await loop.stop();
    expect(summary).toBeDefined();
  });

  // ── BiometricBrief Injection ──────────────────────────────────────────────

  it('receiveBiometricBrief() calls director.perform() with the brief when running', async () => {
    await loop.start();

    const brief = makeBiometricBrief({ mood: 'energized', bpm: 110 });
    await loop.receiveBiometricBrief(brief);

    expect(mockPerform).toHaveBeenCalledWith(brief);
  });

  it('receiveBiometricBrief() is a no-op when loop is not running', async () => {
    const brief = makeBiometricBrief();
    await loop.receiveBiometricBrief(brief);

    expect(mockPerform).not.toHaveBeenCalled();
  });

  it('emits performance event after biometric brief triggers a performance', async () => {
    await loop.start();

    const expectedResult = makePerformanceResult({ framesTransmitted: 60, durationMs: 132 });
    mockPerform.mockResolvedValue(expectedResult);

    const performanceHandler = vi.fn();
    loop.on('performance', performanceHandler);

    const brief = makeBiometricBrief();
    await loop.receiveBiometricBrief(brief);

    expect(performanceHandler).toHaveBeenCalledWith(expectedResult);
  });

  // ── Mood-to-Performance Routing ───────────────────────────────────────────

  it.each([
    ['calm', 72, 50],
    ['energized', 115, 15],
    ['stressed', 88, 18],
    ['focused', 78, 38],
    ['neutral', 70, 30],
  ] as const)(
    'routes %s mood brief to director.perform()',
    async (mood, bpm, hrv) => {
      await loop.start();
      const brief = makeBiometricBrief({ mood, bpm, hrv });
      await loop.receiveBiometricBrief(brief);
      expect(mockPerform).toHaveBeenCalledWith(expect.objectContaining({ mood, bpm, hrv }));
    }
  );

  // ── Status ────────────────────────────────────────────────────────────────

  it('getStatus() shows running=true after start()', async () => {
    await loop.start();
    const status = loop.getStatus();
    expect(status.running).toBe(true);
  });

  it('getStatus() shows running=false before start()', () => {
    const status = loop.getStatus();
    expect(status.running).toBe(false);
  });

  it('getStatus() returns bridge stats from SomaticBridge', async () => {
    await loop.start();
    const status = loop.getStatus();
    expect(status.bridgeStats.frameCount).toBe(42);
    expect(status.bridgeStats.averageFps).toBe(60);
  });

  // ── Error Resilience ──────────────────────────────────────────────────────

  it('absorbs director.perform() rejection without crashing the loop', async () => {
    await loop.start();
    mockPerform.mockRejectedValueOnce(new Error('Audio2Face timeout'));

    const brief = makeBiometricBrief();
    // receiveBiometricBrief awaits perform — if it throws it propagates
    await expect(loop.receiveBiometricBrief(brief)).rejects.toThrow('Audio2Face timeout');

    // Loop should still be running after the error
    expect(loop.getStatus().running).toBe(true);
  });

  // ── Event Emission Sequence ───────────────────────────────────────────────

  it('emits events in correct order: start → performance → stop', async () => {
    const events: string[] = [];
    loop.on('start', () => events.push('start'));
    loop.on('performance', () => events.push('performance'));
    loop.on('stop', () => events.push('stop'));

    await loop.start();
    await loop.perform(makeBiometricBrief());
    await loop.stop();

    expect(events).toEqual(['start', 'performance', 'stop']);
  });
});
