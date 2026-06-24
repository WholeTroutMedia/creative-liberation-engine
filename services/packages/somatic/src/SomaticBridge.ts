/**
 * @cle/somatic — SomaticBridge
 *
 * The central orchestrator for the Project Omnimedia pipeline.
 * Receives Audio2Face ARKit payload via HTTP POST, interprets the blendshape
 * data, and emits high-frequency OSC UDP packets to a headless UE5 instance.
 *
 * Architecture:
 *   [Audio2Face HTTP POST] → SomaticBridge → Audio2FaceInterpreter → UDPEmitter → UE5 OSC
 */

import * as http from 'http';
import { Audio2FaceInterpreter, RawAudio2FacePayload } from './Audio2FaceInterpreter.js';
import { UDPEmitter, UDPEmitterOptions } from './UDPEmitter.js';
import { ARKitFrame } from './types/ARKit.js';
import { BridgeStats } from './types.js';
import { performanceMonitor } from './PerformanceMonitor.js';

export interface SomaticBridgeOptions {
  /** Port for the HTTP ingestion server (receives Audio2Face payloads) */
  httpPort?: number;
  /** UE5 target host */
  ue5Host?: string;
  /** UE5 OSC target port */
  ue5OscPort?: number;
  /** OSC address pattern for blendshapes */
  oscAddress?: string;
  /** Max frames per second to emit (rate limiter) */
  maxFps?: number;
}

const DEFAULTS: Required<SomaticBridgeOptions> = {
  httpPort: 6060,
  ue5Host: '127.0.0.1',
  ue5OscPort: 5005,
  oscAddress: '/somatic/arkit',
  maxFps: 60,
};

/**
 * SomaticBridge — the Somatic layer of the Consciousness architecture.
 *
 * Tier 2 of the three-tier pipeline:
 *   Tier 1: Genesis Compiler  (AI/audio → blendshape generation)
 *   Tier 2: Somatic Bridge    (THIS CLASS — protocol translation & streaming)
 *   Tier 3: Continuous Loop   (autonomy, memory, feedback)
 */
export class SomaticBridge {
  private readonly opts: Required<SomaticBridgeOptions>;
  private emitter: UDPEmitter;
  private server: http.Server | null = null;
  private frameCount = 0;
  private droppedCount = 0;
  private startTime = 0;
  private lastFrameTime = 0;
  private minFrameInterval: number;
  /** Ingest timestamp — set at HTTP POST receipt, read in submitFrame */
  private frameIngestTime = 0;

  constructor(options: SomaticBridgeOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
    this.minFrameInterval = 1000 / this.opts.maxFps;

    const emitterOpts: UDPEmitterOptions = {
      remoteAddress: this.opts.ue5Host,
      remotePort: this.opts.ue5OscPort,
      oscAddressPattern: this.opts.oscAddress,
    };

    this.emitter = new UDPEmitter(emitterOpts);
  }

  /**
   * Start the bridge — connect UDP emitter and open HTTP ingestion server.
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.emitter.connect();
      this.startTime = Date.now();
      this.lastFrameTime = 0;

      this.server = http.createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/ingest') {
          const ingestStart = Date.now();
          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const raw: RawAudio2FacePayload = JSON.parse(body);
              const frame = Audio2FaceInterpreter.parse(raw);
              this.frameIngestTime = ingestStart;
              this.submitFrame(frame);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, frameCount: this.frameCount }));
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'parse error';
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: msg }));
            }
          });
        } else if (req.method === 'GET' && req.url === '/stats') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.getStats()));
        } else if (req.method === 'GET' && req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', uptime: Date.now() - this.startTime }));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.server.on('error', reject);
      this.server.listen(this.opts.httpPort, () => {
        console.log(`[somatic] 🧬 SomaticBridge online — HTTP ingestion :${this.opts.httpPort} → OSC UDP ${this.opts.ue5Host}:${this.opts.ue5OscPort}`);
        resolve();
      });
    });
  }

  /**
   * Stop the bridge gracefully.
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.emitter.disconnect();
      if (this.server) {
        this.server.close(() => {
          console.log('[somatic] SomaticBridge stopped.');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Submit an ARKitFrame directly (bypasses HTTP — use for programmatic control).
   * Enforces maxFps rate limiting.
   */
  public submitFrame(frame: ARKitFrame): void {
    const now = Date.now();
    if (now - this.lastFrameTime < this.minFrameInterval) {
      this.droppedCount++;
      return; // rate limited — drop frame to maintain target fps
    }
    this.lastFrameTime = now;
    this.frameCount++;
    this.emitter.sendFrame(frame);

    // ── Tier 3: feed PerformanceMonitor ──────────────────────────────────────
    const oscLatencyMs = Date.now() - now;
    const ingestLatencyMs = this.frameIngestTime > 0 ? now - this.frameIngestTime : 0;
    performanceMonitor.recordFrame({
      timestamp: now,
      ttsLatencyMs: 0,           // upstream — not measurable here
      audio2FaceLatencyMs: ingestLatencyMs,
      oscLatencyMs,
      totalLatencyMs: ingestLatencyMs + oscLatencyMs,
    });
  }

  /**
   * Return current bridge statistics.
   */
  public getStats(): BridgeStats & { currentFps: number; framesDropped: number; queueDepth: number; uptime: number } {
    const elapsed = Date.now() - this.startTime;
    const avgFps = elapsed > 0 ? (this.frameCount / elapsed) * 1000 : 0;
    // currentFps: rolling average over last second
    const rollingStats = performanceMonitor.getRollingStats();
    const currentFps = rollingStats.totalFrames > 0 ? Math.round(avgFps * 10) / 10 : Math.round(avgFps * 10) / 10;
    return {
      frameCount: this.frameCount,
      framesEmitted: this.frameCount,
      framesDropped: this.droppedCount,
      elapsed,
      averageFps: Math.round(avgFps * 10) / 10,
      currentFps,
      targetFps: this.opts.maxFps,
      queueDepth: 0,   // UDP is fire-and-forget; always 0
      uptime: elapsed,
    };
  }
}
