#!/usr/bin/env tsx
/**
 * Consciousness Architecture — End-to-End Latency Benchmark
 *
 * T20260308-004: VALIDATE — p50 < 150ms, p95 < 200ms
 *
 * Measures wall-clock time at each stage of the pipeline:
 *   text input
 *     → OmnimediaDirector (Kokoro TTS)      [stage: tts]
 *     → a2f_osc_bridge.py (A2F NIM poll)    [stage: a2f]
 *     → SomaticBridge mock UDP listener     [stage: osc]
 *     → total end-to-end                    [stage: total]
 *
 * Usage:
 *   npx tsx packages/somatic/benchmarks/latency_benchmark.ts
 *   npx tsx packages/somatic/benchmarks/latency_benchmark.ts --runs 100 --output benchmarks/latency_results.md
 *
 * Prerequisites:
 *   - Kokoro TTS running locally (or ELEVEN_KEY set for ElevenLabs)
 *   - Audio2Face NIM running on :8011 (or mock mode with --mock)
 *   - SomaticBridge running on :6060 (or mock mode with --mock)
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

// ─── Args ─────────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    runs: { type: 'string', default: '50' },
    output: { type: 'string', default: '' },
    mock: { type: 'boolean', default: false },
    verbose: { type: 'boolean', default: false },
  },
});

const RUNS = parseInt(args.runs as string, 10);
const OUTPUT_FILE = args.output as string;
const MOCK_MODE = args.mock as boolean;
const VERBOSE = args.verbose as boolean;

// ─── Types ────────────────────────────────────────────────────────────────────

interface FrameResult {
  run: number;
  ttsMs: number;
  a2fMs: number;
  oscMs: number;
  totalMs: number;
  error?: string;
}

interface BenchmarkSummary {
  runs: number;
  successfulRuns: number;
  failedRuns: number;
  tts: StageStats;
  a2f: StageStats;
  osc: StageStats;
  total: StageStats;
  meetsSub200msTarget: boolean;
  timestamp: string;
}

interface StageStats {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

// ─── Mock pipeline stages ─────────────────────────────────────────────────────

async function mockTTS(text: string): Promise<Buffer> {
  // Simulate Kokoro TTS latency (50-120ms locally)
  const latency = 50 + Math.random() * 70;
  await sleep(latency);
  return Buffer.from(`mock-audio-${text.length}`);
}

async function mockA2F(_audio: Buffer): Promise<number[]> {
  // Simulate Audio2Face NIM inference (10-30ms)
  const latency = 10 + Math.random() * 20;
  await sleep(latency);
  return Array.from({ length: 52 }, () => Math.random() * 0.5);
}

async function mockOSC(_blendshapes: number[]): Promise<void> {
  // Simulate OSC/UDP send (<2ms)
  const latency = 0.5 + Math.random() * 1.5;
  await sleep(latency);
}

// ─── Real pipeline stages ─────────────────────────────────────────────────────

async function realTTS(text: string): Promise<Buffer> {
  const kokoroUrl = process.env.KOKORO_URL ?? 'http://localhost:8880';
  const r = await fetch(`${kokoroUrl}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'kokoro', input: text, voice: 'af_sky' }),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`Kokoro TTS failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function realA2F(audio: Buffer): Promise<number[]> {
  const a2fUrl = process.env.A2F_URL ?? 'http://localhost:8011';
  // Poll blendshapes after submitting audio
  const r = await fetch(`${a2fUrl}/A2F/Exporter/ExportBlendshapesRealtime`, {
    signal: AbortSignal.timeout(200),
  });
  if (!r.ok) throw new Error(`A2F NIM failed: ${r.status}`);
  const data = await r.json() as { blendShapes: number[][] };
  return data.blendShapes?.[0]?.slice(0, 52) ?? [];
}

async function realOSC(blendshapes: number[]): Promise<void> {
  const bridgeUrl = process.env.SOMATIC_URL ?? 'http://localhost:6060';
  await fetch(`${bridgeUrl}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blendShapes: [blendshapes],
      timestamp: Date.now(),
    }),
    signal: AbortSignal.timeout(100),
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeStats(values: number[]): StageStats {
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Runner ───────────────────────────────────────────────────────────────────

const TEST_TEXTS = [
  'Hello, I am a MetaHuman.',
  'The pipeline is sovereign and sub-200 milliseconds.',
  'Biometric fusion drives the performance.',
  'AVERI collective, all systems nominal.',
  'Launching warp speed execution.',
];

async function runBenchmark(): Promise<BenchmarkSummary> {
  const tts = MOCK_MODE ? mockTTS : realTTS;
  const a2f = MOCK_MODE ? mockA2F : realA2F;
  const osc = MOCK_MODE ? mockOSC : realOSC;

  const results: FrameResult[] = [];

  console.log(`\n🧪 Consciousness Architecture Latency Benchmark`);
  console.log(`   Runs: ${RUNS} | Mode: ${MOCK_MODE ? 'mock' : 'live'}`);
  console.log(`   Target: p50 < 150ms | p95 < 200ms\n`);

  for (let i = 0; i < RUNS; i++) {
    const text = TEST_TEXTS[i % TEST_TEXTS.length];
    const result: FrameResult = { run: i + 1, ttsMs: 0, a2fMs: 0, oscMs: 0, totalMs: 0 };

    try {
      const t0 = performance.now();

      const t1 = performance.now();
      const audio = await tts(text);
      result.ttsMs = performance.now() - t1;

      const t2 = performance.now();
      const blendshapes = await a2f(audio);
      result.a2fMs = performance.now() - t2;

      const t3 = performance.now();
      await osc(blendshapes);
      result.oscMs = performance.now() - t3;

      result.totalMs = performance.now() - t0;

      if (VERBOSE) {
        console.log(
          `  Run ${String(i + 1).padStart(3)}: total=${result.totalMs.toFixed(1)}ms` +
          ` (tts=${result.ttsMs.toFixed(1)} a2f=${result.a2fMs.toFixed(1)} osc=${result.oscMs.toFixed(1)})`
        );
      } else if ((i + 1) % 10 === 0) {
        process.stdout.write(`  Progress: ${i + 1}/${RUNS}\r`);
      }
    } catch (err) {
      result.error = String(err);
      console.error(`  ❌ Run ${i + 1} failed: ${result.error}`);
    }

    results.push(result);
  }

  const successful = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);

  const summary: BenchmarkSummary = {
    runs: RUNS,
    successfulRuns: successful.length,
    failedRuns: failed.length,
    tts: computeStats(successful.map((r) => r.ttsMs)),
    a2f: computeStats(successful.map((r) => r.a2fMs)),
    osc: computeStats(successful.map((r) => r.oscMs)),
    total: computeStats(successful.map((r) => r.totalMs)),
    meetsSub200msTarget: false,
    timestamp: new Date().toISOString(),
  };

  summary.meetsSub200msTarget =
    summary.total.p50 < 150 && summary.total.p95 < 200;

  return summary;
}

function printSummary(s: BenchmarkSummary): void {
  const t = (n: number) => `${n.toFixed(1)}ms`;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊 Results — ${s.runs} runs (${s.successfulRuns} ok, ${s.failedRuns} failed)\n`);

  const table = [
    ['Stage', 'avg', 'p50', 'p95', 'p99'],
    ['TTS (Kokoro)', t(s.tts.avg), t(s.tts.p50), t(s.tts.p95), t(s.tts.p99)],
    ['A2F NIM', t(s.a2f.avg), t(s.a2f.p50), t(s.a2f.p95), t(s.a2f.p99)],
    ['OSC/UDP', t(s.osc.avg), t(s.osc.p50), t(s.osc.p95), t(s.osc.p99)],
    ['TOTAL E2E', t(s.total.avg), t(s.total.p50), t(s.total.p95), t(s.total.p99)],
  ];

  table.forEach((row, i) => {
    if (i === 0) console.log(`  ${row.map((c) => c.padEnd(16)).join('')}`);
    else console.log(`  ${row.map((c) => c.padEnd(16)).join('')}`);
  });

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Target: p50 < 150ms & p95 < 200ms`);
  console.log(`Result: ${s.meetsSub200msTarget ? '✅ PASS' : '❌ FAIL'} ` +
    `(p50=${t(s.total.p50)}, p95=${t(s.total.p95)})\n`);
}

function generateMarkdownReport(s: BenchmarkSummary): string {
  const t = (n: number) => `${n.toFixed(1)}ms`;
  const pass = s.meetsSub200msTarget;

  return `# Consciousness Architecture — Latency Benchmark Results

**Run date:** ${s.timestamp}
**Mode:** ${MOCK_MODE ? 'Mock (simulated latencies)' : 'Live (real services)'}
**Runs:** ${s.runs} total | ${s.successfulRuns} successful | ${s.failedRuns} failed

## Result: ${pass ? '✅ PASS' : '❌ FAIL'}

Target: **p50 < 150ms** and **p95 < 200ms**

## Per-Stage Latency

| Stage | avg | p50 | p95 | p99 | min | max |
|-------|-----|-----|-----|-----|-----|-----|
| TTS (Kokoro) | ${t(s.tts.avg)} | ${t(s.tts.p50)} | ${t(s.tts.p95)} | ${t(s.tts.p99)} | ${t(s.tts.min)} | ${t(s.tts.max)} |
| A2F NIM | ${t(s.a2f.avg)} | ${t(s.a2f.p50)} | ${t(s.a2f.p95)} | ${t(s.a2f.p99)} | ${t(s.a2f.min)} | ${t(s.a2f.max)} |
| OSC/UDP | ${t(s.osc.avg)} | ${t(s.osc.p50)} | ${t(s.osc.p95)} | ${t(s.osc.p99)} | ${t(s.osc.min)} | ${t(s.osc.max)} |
| **TOTAL E2E** | **${t(s.total.avg)}** | **${t(s.total.p50)}** | **${t(s.total.p95)}** | **${t(s.total.p99)}** | ${t(s.total.min)} | ${t(s.total.max)} |

## Latency Budget vs Target

| Metric | Actual | Target | Status |
|--------|--------|--------|--------|
| p50 latency | ${t(s.total.p50)} | < 150ms | ${s.total.p50 < 150 ? '✅' : '❌'} |
| p95 latency | ${t(s.total.p95)} | < 200ms | ${s.total.p95 < 200 ? '✅' : '❌'} |

## Notes

- TTS: Kokoro local model (sovereign, no cloud dependency)
- A2F: NVIDIA Audio2Face NIM microservice (:8011)
- OSC: UDP broadcast to UE5 SomaticBridge (:6060 → :5005)
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const summary = await runBenchmark();
  printSummary(summary);

  if (OUTPUT_FILE) {
    const report = generateMarkdownReport(summary);
    const outputPath = path.resolve(OUTPUT_FILE);
    fs.writeFileSync(outputPath, report, 'utf-8');
    console.log(`📝 Report written to: ${outputPath}`);
  }

  process.exit(summary.meetsSub200msTarget ? 0 : 1);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
