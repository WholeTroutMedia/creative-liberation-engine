/**
 * @cle/somatic — ConsciousnessLoop
 *
 * The integration entry point for the full three-tier Consciousness Architecture.
 *
 * Wires all tiers together:
 *   Tier 1 — OmnimediaDirector   (text/biometric → TTS → Audio2Face → SomaticBridge)
 *   Tier 2 — SomaticBridge       (ARKit ingestion → OSC/UDP → UE5 MetaHuman)
 *   Tier 3 — PerformanceMonitor  (frame telemetry → KEEPER memory)
 *
 * Optional Sensor Mesh integration (when @cle/sensor-mesh is available):
 *   BiometricBridge → OmnimediaDirector (body state drives MetaHuman performance)
 *
 * Usage:
 *   const loop = new ConsciousnessLoop({ elevenLabsKey: process.env.ELEVEN_KEY });
 *   await loop.start();
 *
 *   // Manual performance
 *   await loop.director.perform({ text: "Hello world", voiceId: "default" });
 *
 *   // Biometric-driven (if sensor mesh wired)
 *   loop.on('performance', (result) => console.log(result.framesTransmitted));
 *
 *   // Graceful shutdown
 *   await loop.stop();
 */

import { EventEmitter } from 'events';
import { OmnimediaDirector, DirectorOptions, PerformanceBrief, BiometricBrief } from './OmnimediaDirector.js';
import { SomaticBridge, SomaticBridgeOptions } from './SomaticBridge.js';
import { performanceMonitor, PerformanceSummary } from './PerformanceMonitor.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConsciousnessLoopOptions {
  /** OmnimediaDirector configuration */
  director?: DirectorOptions;
  /** SomaticBridge configuration */
  bridge?: SomaticBridgeOptions;
  /**
   * When true, the loop will automatically poll the SomaticBridge /stats endpoint
   * and feed data back to PerformanceMonitor.
   * Default: true
   */
  enableStatsPolling?: boolean;
  /**
   * Stats polling interval in milliseconds. Default: 5000ms
   */
  statsPollingIntervalMs?: number;
}

export interface PerformanceResult {
  framesTransmitted: number;
  durationMs: number;
  synthesizedPrompt?: string;
}

// ─── ConsciousnessLoop ────────────────────────────────────────────────────────

/**
 * ConsciousnessLoop — the sovereign integration runtime for the MetaHuman pipeline.
 *
 * This class is the main entry point for production deployments. It boots all
 * three tiers of the Consciousness Architecture and provides:
 *   - Manual trigger via loop.director.perform()
 *   - Biometric-driven performances via external BiometricBrief injection
 *   - Automated telemetry polling and KEEPER flush
 *   - Graceful start/stop lifecycle
 *
 * Architecture validation:
 *   ✅ Tier 1 (OmnimediaDirector) — boots on construction
 *   ✅ Tier 2 (SomaticBridge)    — boots via start(), HTTP :6060 + UDP :5005
 *   ✅ Tier 3 (PerformanceMonitor) — singleton, auto-wired
 */
export class ConsciousnessLoop extends EventEmitter {
  public readonly director: OmnimediaDirector;
  public readonly bridge: SomaticBridge;

  private readonly opts: Required<ConsciousnessLoopOptions>;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(options: ConsciousnessLoopOptions = {}) {
    super();

    this.opts = {
      director: options.director ?? {},
      bridge: options.bridge ?? {},
      enableStatsPolling: options.enableStatsPolling ?? true,
      statsPollingIntervalMs: options.statsPollingIntervalMs ?? 5000,
    };

    // Tier 1 — Genesis Compiler
    this.director = new OmnimediaDirector(this.opts.director);

    // Tier 2 — Somatic Bridge
    this.bridge = new SomaticBridge(this.opts.bridge);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Boot the Consciousness Architecture.
   *
   * Boots SomaticBridge HTTP server and UDP emitter.
   * Starts stats polling if enabled.
   * Starts a new PerformanceMonitor session.
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[consciousness] Already running — ignoring start()');
      return;
    }

    console.log('[consciousness] 🧠 Booting Consciousness Architecture...');

    // Start Tier 2
    await this.bridge.start();
    console.log('[consciousness] ✅ Tier 2 — SomaticBridge online');

    // Start Tier 3 session
    performanceMonitor.startSession(`consciousness-${Date.now()}`);
    console.log('[consciousness] ✅ Tier 3 — PerformanceMonitor session started');

    // Stats polling loop
    if (this.opts.enableStatsPolling) {
      this.statsInterval = setInterval(() => this.pollStats(), this.opts.statsPollingIntervalMs);
    }

    this.isRunning = true;
    console.log('[consciousness] 🚀 Consciousness Architecture online — all 3 tiers active');
    this.emit('start');
  }

  /**
   * Gracefully stop the Consciousness Architecture.
   *
   * Flushes PerformanceMonitor stats to KEEPER, stops bridge and polling.
   */
  public async stop(): Promise<PerformanceSummary> {
    if (!this.isRunning) {
      console.warn('[consciousness] Not running — ignoring stop()');
      return performanceMonitor.getStats();
    }

    console.log('[consciousness] 🛑 Shutting down Consciousness Architecture...');

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    await this.bridge.stop();

    // Flush session stats to KEEPER memory
    const summary = await performanceMonitor.endSession();
    console.log(
      `[consciousness] 📊 Session complete — ${summary.totalFrames} frames | ` +
      `avg ${summary.avgLatencyMs.toFixed(1)}ms | p95 ${summary.p95LatencyMs.toFixed(1)}ms | ` +
      `sub-200ms: ${summary.meetsSub200msTarget ? '✅' : '❌'}`
    );

    this.isRunning = false;
    this.emit('stop', summary);
    return summary;
  }

  // ── Performance API ───────────────────────────────────────────────────────

  /**
   * Execute a performance from text input.
   *
   * Convenience method that delegates to OmnimediaDirector.perform().
   * Emits 'performance' event on completion.
   */
  public async perform(brief: PerformanceBrief | BiometricBrief): Promise<PerformanceResult> {
    const result = await this.director.perform(brief);
    this.emit('performance', result);
    return result;
  }

  /**
   * Called by external BiometricBridge integration.
   *
   * Example wiring pattern (requires @cle/sensor-mesh):
   *
   *   import { BiometricBridge } from '@cle/sensor-mesh';
   *   const biometrics = new BiometricBridge();
   *   const loop = new ConsciousnessLoop({ elevenLabsKey: key });
   *   await loop.start();
   *   await biometrics.start();
   *   biometrics.on('brief', (brief) => loop.receiveBiometricBrief(brief));
   */
  public async receiveBiometricBrief(brief: BiometricBrief): Promise<void> {
    if (!this.isRunning) return;
    const result = await this.perform(brief);
    console.log(`[consciousness] 🫀 BiometricBrief performance: ${result.framesTransmitted} frames in ${result.durationMs}ms`);
  }

  // ── Status ────────────────────────────────────────────────────────────────

  /**
   * Get current runtime status.
   */
  public getStatus(): {
    running: boolean;
    bridgeStats: ReturnType<SomaticBridge['getStats']>;
    sessionStats: PerformanceSummary;
  } {
    return {
      running: this.isRunning,
      bridgeStats: this.bridge.getStats(),
      sessionStats: performanceMonitor.getStats(),
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private pollStats(): void {
    const stats = this.bridge.getStats();
    this.emit('stats', stats);

    if (stats.framesDropped > 0) {
      const dropRate = stats.framesDropped / (stats.frameCount + stats.framesDropped);
      if (dropRate > 0.1) {
        console.warn(
          `[consciousness] ⚠️  High frame drop rate: ${(dropRate * 100).toFixed(1)}%` +
          ` (${stats.framesDropped} dropped / ${stats.frameCount} total)`
        );
        this.emit('warning', { type: 'high-drop-rate', dropRate, stats });
      }
    }
  }
}
