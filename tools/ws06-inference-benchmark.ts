#!/usr/bin/env node
// WS-06: vLLM vs Ollama Benchmark
// Measures tokens/sec, time-to-first-token, and memory consumption
// for local inference workloads on the RTX 4090 workstation.

interface InferenceResult {
  backend: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTimeMs: number;
  timeToFirstTokenMs: number;
  tokensPerSecond: number;
  peakMemoryMB: number;
}

// ─── Ollama Runner ───────────────────────────────────────────────

async function benchOllama(
  host: string,
  model: string,
  prompt: string,
  maxTokens: number
): Promise<InferenceResult> {
  const start = performance.now();
  let firstTokenTime: number | null = null;
  let totalTokens = 0;
  let responseText = '';

  const res = await fetch(`${host}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: true, options: { num_predict: maxTokens } })
  });

  if (!res.ok || !res.body) throw new Error(`Ollama error: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n').filter(l => l.trim())) {
      try {
        const data = JSON.parse(line);
        if (data.response) {
          if (firstTokenTime === null) firstTokenTime = performance.now();
          responseText += data.response;
          totalTokens++;
        }
      } catch {}
    }
  }

  const totalTime = performance.now() - start;
  return {
    backend: 'Ollama',
    model,
    promptTokens: Math.ceil(prompt.length / 4),
    completionTokens: totalTokens,
    totalTimeMs: Math.round(totalTime),
    timeToFirstTokenMs: Math.round((firstTokenTime || totalTime) - start),
    tokensPerSecond: Math.round((totalTokens / totalTime) * 1000 * 10) / 10,
    peakMemoryMB: 0 // requires nvidia-smi polling
  };
}

// ─── vLLM Runner ─────────────────────────────────────────────────

async function benchVLLM(
  host: string,
  model: string,
  prompt: string,
  maxTokens: number
): Promise<InferenceResult> {
  const start = performance.now();
  let firstTokenTime: number | null = null;
  let totalTokens = 0;

  const res = await fetch(`${host}/v1/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, max_tokens: maxTokens, stream: true })
  });

  if (!res.ok || !res.body) throw new Error(`vLLM error: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n').filter(l => l.startsWith('data:'))) {
      const data = line.slice(5).trim();
      if (data === '[DONE]') break;
      try {
        const parsed = JSON.parse(data);
        if (parsed.choices?.[0]?.text) {
          if (firstTokenTime === null) firstTokenTime = performance.now();
          totalTokens += parsed.choices[0].text.length > 0 ? 1 : 0;
        }
      } catch {}
    }
  }

  const totalTime = performance.now() - start;
  return {
    backend: 'vLLM',
    model,
    promptTokens: Math.ceil(prompt.length / 4),
    completionTokens: totalTokens,
    totalTimeMs: Math.round(totalTime),
    timeToFirstTokenMs: Math.round((firstTokenTime || totalTime) - start),
    tokensPerSecond: Math.round((totalTokens / totalTime) * 1000 * 10) / 10,
    peakMemoryMB: 0
  };
}

// ─── Benchmark Prompts ───────────────────────────────────────────

const PROMPTS = {
  short: 'Explain the concept of mTLS in 3 sentences.',
  medium: 'Write a detailed implementation plan for a semantic deduplication engine that processes vector embeddings. Include architecture decisions, performance considerations, and testing strategy.',
  code: 'Write a TypeScript function that implements a priority queue with decrease-key operation using a binary heap. Include full type annotations and JSDoc comments.'
};

import { writeFileSync } from 'fs';

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  let ollamaHost = process.env.OLLAMA_HOST || 'http://192.168.2.20:11434';
  if (!ollamaHost.startsWith('http')) ollamaHost = 'http://' + ollamaHost;
  if (!ollamaHost.includes(':')) ollamaHost += ':11434';
  
  let vllmHost = process.env.VLLM_HOST || 'http://localhost:8001';
  if (!vllmHost.startsWith('http')) vllmHost = 'http://' + vllmHost;

  const model = process.env.BENCH_MODEL || 'qwen2.5:14b';
  const maxTokens = parseInt(process.env.MAX_TOKENS || '256');

  console.log('WS-06 Inference Benchmark');
  console.log(`  Model: ${model} | MaxTokens: ${maxTokens}`);
  console.log(`  Ollama: ${ollamaHost} | vLLM: ${vllmHost}\n`);

  const results: InferenceResult[] = [];

  for (const [name, prompt] of Object.entries(PROMPTS)) {
    console.log(`─ Prompt: ${name} (${prompt.length} chars) ─`);

    try {
      const r = await benchOllama(ollamaHost, model, prompt, maxTokens);
      results.push(r);
      console.log(`  Ollama: ${r.tokensPerSecond} tok/s, TTFT=${r.timeToFirstTokenMs}ms, total=${r.totalTimeMs}ms`);
    } catch (e) { console.log(`  Ollama: SKIPPED (${e})`); }

    try {
      const r = await benchVLLM(vllmHost, model, prompt, maxTokens);
      results.push(r);
      console.log(`  vLLM:   ${r.tokensPerSecond} tok/s, TTFT=${r.timeToFirstTokenMs}ms, total=${r.totalTimeMs}ms`);
    } catch (e) { console.log(`  vLLM: SKIPPED (${e})`); }
  }

  // Summary
  console.log('\n══ SUMMARY ══');
  const grouped = new Map<string, InferenceResult[]>();
  for (const r of results) {
    if (!grouped.has(r.backend)) grouped.set(r.backend, []);
    grouped.get(r.backend)!.push(r);
  }

  for (const [backend, runs] of grouped) {
    const avgTps = runs.reduce((s, r) => s + r.tokensPerSecond, 0) / runs.length;
    const avgTtft = runs.reduce((s, r) => s + r.timeToFirstTokenMs, 0) / runs.length;
    console.log(`  ${backend}: ${avgTps.toFixed(1)} avg tok/s, ${Math.round(avgTtft)}ms avg TTFT`);
  }

  const report = { timestamp: new Date().toISOString(), model, maxTokens, results };
  writeFileSync('C:/Users/jahar/AppData/Local/Temp/ws06-benchmark-results.json', JSON.stringify(report, null, 2));
  console.log('\nReport: C:/Users/jahar/AppData/Local/Temp/ws06-benchmark-results.json');
}

main().catch(console.error);
