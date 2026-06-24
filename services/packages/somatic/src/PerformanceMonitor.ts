/**
 * PerformanceMonitor — Somatic Tier 3
 *
 * Frame-level telemetry for the OmnimediaMetaHuman pipeline.
 * Tracks per-frame latency across TTS → Audio2Face → OSC/UDP → UE5.
 * Detects dropped frames (>16.67ms processing = missed 60fps slot).
 * Maintains a rolling 60-frame latency histogram.
 * Writes session summaries to KEEPER memory on session end.
 *
 * Wire-up:
 *   - SomaticBridge calls recordFrame() after each OSC emit
 *   - OmnimediaDirector calls startSession() / endSession()
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Metric snapshot for a single animation frame */
export interface FrameMetric {
  /** Wall-clock timestamp (ms since epoch) */
  timestamp: number;
  /** TTS first-byte to audio buffer complete (ms) */
  ttsLatencyMs: number;
  /** Audio buffer to Audio2Face ARKit response complete (ms) */
  audio2FaceLatencyMs: number;
  /** ARKit data received to UDP OSC packet sent (ms) */
  oscLatencyMs: number;
  /** Sum of all three stages (ms) */
  totalLatencyMs: number;
  /** True if totalLatencyMs > 16.67 (frame budget at 60fps) */
  dropped: boolean;
}

/** Aggregated stats for a session or window */
export interface PerformanceSummary {
  /** Total frames recorded */
  totalFrames: number;
  /** Frames that exceeded the 60fps budget */
  droppedFrames: number;
  /** Drop rate 0–1 */
  dropRate: number;
  /** Average end-to-end latency (ms) */
  avgLatencyMs: number;
  /** p50 latency (ms) */
  p50LatencyMs: number;
  /** p95 latency (ms) */
  p95LatencyMs: number;
  /** p99 latency (ms) */
  p99LatencyMs: number;
  /** Min/Max total latency */
  minLatencyMs: number;
  maxLatencyMs: number;
  /** Whether pipeline is meeting sub-200ms target */
  meetsSub200msTarget: boolean;
  /** Session start timestamp */
  sessionStartedAt: number;
  /** Session end timestamp (set by endSession()) */
  sessionEndedAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** 60fps frame budget in ms */
const FRAME_BUDGET_MS = 1000 / 60; // ≈ 16.67ms

/** Maximum frames kept in the rolling window */
const ROLLING_WINDOW_SIZE = 60;

/** End-to-end latency target for the MetaHuman pipeline */
const SUB_200MS_TARGET_MS = 200;

/** KEEPER memory endpoint (Genkit server) */
const KEEPER_ENDPOINT = process.env['GENKIT_URL'] ?? 'http://localhost:4100';

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE MONITOR
// ─────────────────────────────────────────────────────────────────────────────

export class PerformanceMonitor {
  private frames: FrameMetric[] = [];
  private rollingWindow: FrameMetric[] = [];
  private sessionStartedAt: number;
  private sessionId: string;

  constructor() {
    this.sessionStartedAt = Date.now();
    this.sessionId = `somatic-session-${this.sessionStartedAt}`;
  }

  // ── Frame Recording ───────────────────────────────────────────────────────

  /**
   * Record a single frame's latency metrics.
   * Called by SomaticBridge after each OSC packet is sent.
   */
  recordFrame(metric: Omit<FrameMetric, 'dropped'>): void {
    const full: FrameMetric = {
      ...metric,
      dropped: metric.totalLatencyMs > FRAME_BUDGET_MS,
    };

    this.frames.push(full);

    // Rolling window — keep last N frames
    this.rollingWindow.push(full);
    if (this.rollingWindow.length > ROLLING_WINDOW_SIZE) {
      this.rollingWindow.shift();
    }

    // Warn on dropped frame
    if (full.dropped) {
      console.warn(
        `[PERFORMANCE-MONITOR] ⚠️  Dropped frame: ${full.totalLatencyMs.toFixed(2)}ms` +
          ` (budget: ${FRAME_BUDGET_MS.toFixed(2)}ms)` +
          ` | TTS:${full.ttsLatencyMs.toFixed(1)} A2F:${full.audio2FaceLatencyMs.toFixed(1)} OSC:${full.oscLatencyMs.toFixed(1)}`
      );
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  /** Get aggregated stats for the entire session */
  getStats(): PerformanceSummary {
    return this.computeStats(this.frames, this.sessionStartedAt);
  }

  /** Get aggregated stats for the current rolling window (last 60 frames) */
  getRollingStats(): PerformanceSummary {
    return this.computeStats(
      this.rollingWindow,
      this.rollingWindow[0]?.timestamp ?? this.sessionStartedAt
    );
  }

  // ── Session Management ────────────────────────────────────────────────────

  /** Start a new session (resets frame history) */
  startSession(sessionId?: string): void {
    this.frames = [];
    this.rollingWindow = [];
    this.sessionStartedAt = Date.now();
    this.sessionId = sessionId ?? `somatic-session-${this.sessionStartedAt}`;
    console.log(`[PERFORMANCE-MONITOR] 🎬 Session started: ${this.sessionId}`);
  }

  /**
   * End the session and flush stats to KEEPER memory.
   * Non-blocking — logs error if KEEPER is unreachable.
   */
  async endSession(): Promise<PerformanceSummary> {
    const stats: PerformanceSummary = {
      ...this.computeStats(this.frames, this.sessionStartedAt),
      sessionEndedAt: Date.now(),
    };

    const durationSec = ((stats.sessionEndedAt! - this.sessionStartedAt) / 1000).toFixed(1);
    console.log(
      `[PERFORMANCE-MONITOR] 🏁 Session ended: ${this.sessionId}` +
        ` | ${stats.totalFrames} frames` +
        ` | ${(stats.dropRate * 100).toFixed(1)}% dropped` +
        ` | avg ${stats.avgLatencyMs.toFixed(1)}ms` +
        ` | p95 ${stats.p95LatencyMs.toFixed(1)}ms` +
        ` | ${durationSec}s duration`
    );

    // Fire-and-forget to KEEPER
    this.flushToKeeper(stats).catch(err => {
      console.warn('[PERFORMANCE-MONITOR] ⚠️  KEEPER flush failed:', err);
    });

    return stats;
  }

  // ── KEEPER Memory Write ───────────────────────────────────────────────────

  /**
   * Write session performance summary to KEEPER long-term memory.
   * Uses the Genkit /retrieve endpoint with a store call pattern.
   */
  async flushToKeeper(stats: PerformanceSummary): Promise<void> {
    const content = [
      `MetaHuman Pipeline Performance — ${this.sessionId}`,
      `Frames: ${stats.totalFrames} total, ${stats.droppedFrames} dropped (${(stats.dropRate * 100).toFixed(1)}%)`,
      `Latency: avg ${stats.avgLatencyMs.toFixed(1)}ms | p50 ${stats.p50LatencyMs.toFixed(1)}ms | p95 ${stats.p95LatencyMs.toFixed(1)}ms | p99 ${stats.p99LatencyMs.toFixed(1)}ms`,
      `Sub-200ms target: ${stats.meetsSub200msTarget ? 'MET ✅' : 'MISSED ❌'}`,
      `Range: ${stats.minLatencyMs.toFixed(1)}ms – ${stats.maxLatencyMs.toFixed(1)}ms`,
    ].join('\n');

    const response = await fetch(`${KEEPER_ENDPOINT}/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: content,
        mode: 'store',
        metadata: {
          agent: 'somatic-performance-monitor',
          sessionId: this.sessionId,
          stats,
        },
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new Error(`KEEPER returned HTTP ${response.status}`);
    }

    console.log('[PERFORMANCE-MONITOR] 💾 Stats flushed to KEEPER memory');
  }

  // ── Internal: Stat Computation ───────────────────────────────────────────

  private computeStats(frames: FrameMetric[], startedAt: number): PerformanceSummary {
    if (frames.length === 0) {
      return {
        totalFrames: 0,
        droppedFrames: 0,
        dropRate: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        meetsSub200msTarget: true,
        sessionStartedAt: startedAt,
      };
    }

    const latencies = frames.map(f => f.totalLatencyMs).sort((a, b) => a - b);
    const dropped = frames.filter(f => f.dropped).length;
    const avg = latencies.reduce((s, v) => s + v, 0) / latencies.length;
    const p50 = this.percentile(latencies, 50);
    const p95 = this.percentile(latencies, 95);
    const p99 = this.percentile(latencies, 99);

    return {
      totalFrames: frames.length,
      droppedFrames: dropped,
      dropRate: dropped / frames.length,
      avgLatencyMs: avg,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      minLatencyMs: latencies[0]!,
      maxLatencyMs: latencies[latencies.length - 1]!,
      meetsSub200msTarget: p95 < SUB_200MS_TARGET_MS,
      sessionStartedAt: startedAt,
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]!;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

/** Singleton PerformanceMonitor instance for the running SomaticBridge session */
export const performanceMonitor = new PerformanceMonitor();
