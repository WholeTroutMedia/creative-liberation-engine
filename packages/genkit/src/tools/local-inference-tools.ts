/**
 * Local Multimodal Inference Genkit Tools
 *
 * WS-6: Nemotron 3 33B + DeepSeek R1
 *
 * ARCHITECTURE:
 *   These tools run ON THE NAS as Genkit tool definitions.
 *   They dispatch inference requests to the WORKSTATION (192.168.2.20)
 *   where Ollama + RTX 4090 handle GPU compute.
 *
 *   NAS (127.0.0.1)         = orchestrator, runs this code
 *   Workstation (192.168.2.20) = GPU node, runs Ollama
 */

import { ai, z } from '../ai.js';

// ─── Model Tier Config ───────────────────────────────────────────────────────

interface LocalModelConfig {
  model: string;
  tier: string;
  endpoint: string;
  capabilities: string[];
}

const LOCAL_MODELS: Record<string, LocalModelConfig> = {
  'nemotron-omni': {
    model: process.env.MODEL_LOCAL_MULTIMODAL || 'nvidia/nemotron-3-ultra',
    tier: 'local:multimodal',
    endpoint: process.env.NVIDIA_NIM_HOST || 'http://192.168.2.25:8000',
    capabilities: ['text', 'vision', 'audio', 'tool_calling', 'structured_output'],
  },
  'deepseek-reasoning': {
    model: 'deepseek-r1:32b',
    tier: 'local:reasoning',
    endpoint: 'http://192.168.2.20:11434',
    capabilities: ['text', 'code', 'reasoning', 'agentic', 'tool_calling'],
  },
  'deepseek-reasoning-fast': {
    model: 'deepseek-r1:8b',
    tier: 'local:reasoning:fast',
    endpoint: 'http://192.168.2.20:11434',
    capabilities: ['text', 'code', 'reasoning'],
  },
};

// ─── Helper: Ollama API Call ─────────────────────────────────────────────────

async function ollamaGenerate(
  model: string,
  prompt: string,
  opts: {
    images?: string[];
    system?: string;
    temperature?: number;
    format?: 'json' | undefined;
  } = {}
): Promise<{ response: string; model: string; totalDurationMs: number; evalCount: number }> {
  // If model is NVIDIA NIM, route appropriately
  if (model.startsWith('nvidia/')) {
    const nimHost = process.env.NVIDIA_NIM_HOST ?? 'http://192.168.2.25:8000';
    const apiKey = process.env.NVIDIA_API_KEY ?? 'no-key-required';
    const t0 = Date.now();
    
    console.log(`[LOCAL-INFERENCE] 🟢 Routing multimodal request to NVIDIA NIM at ${nimHost}...`);
    try {
      const messages = [];
      if (opts.system) {
        messages.push({ role: 'system', content: opts.system });
      }
      messages.push({ role: 'user', content: prompt });

      const res = await fetch(`${nimHost}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model.replace('nvidia/', ''),
          messages,
          temperature: opts.temperature ?? 0.7,
        }),
      });

      if (!res.ok) {
        throw new Error(`NVIDIA NIM failed: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      return {
        response: data.choices?.[0]?.message?.content ?? '',
        model: data.model ?? model,
        totalDurationMs: Date.now() - t0,
        evalCount: data.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      console.warn(`[LOCAL-INFERENCE] ⚠️ NVIDIA NIM failed (${(err as Error).message}) — falling back to Ollama fallback`);
      // Fallback model name for Ollama
      return ollamaGenerate('nemotron3', prompt, opts);
    }
  }

  const endpoint = process.env.OLLAMA_HOST || 'http://192.168.2.20:11434';
  const body: any = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: opts.temperature ?? 0.7,
    },
  };

  if (opts.system) body.system = opts.system;
  if (opts.images) body.images = opts.images;
  if (opts.format) body.format = opts.format;

  const res = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Ollama ${model} failed: ${res.status} ${res.statusText}`);
  }

  const data: any = await res.json();
  return {
    response: data.response,
    model: data.model,
    totalDurationMs: Math.round((data.total_duration || 0) / 1e6),
    evalCount: data.eval_count || 0,
  };
}

// ─── Multimodal Reasoning Tool (Nemotron) ─────────────────────────────────────

export const multimodalReasonTool = ai.defineTool(
  {
    name: 'localMultimodalReason',
    description:
      'Run multimodal reasoning locally on RTX 4090 using NVIDIA Nemotron 3 (30B MoE, 3B active). ' +
      'Accepts text + optional image. Supports tool calling and structured output. ' +
      'Zero cloud dependency — fully sovereign inference.',
    inputSchema: z.object({
      prompt: z.string().describe('Text prompt for reasoning'),
      imageBase64: z.string().optional().describe('Optional base64-encoded image for vision tasks'),
      systemPrompt: z.string().optional().describe('Optional system prompt override'),
      temperature: z.number().min(0).max(2).optional().default(0.7),
      structuredOutput: z.boolean().optional().default(false).describe('Request JSON-structured output'),
    }),
    outputSchema: z.object({
      response: z.string(),
      model: z.string(),
      tier: z.string(),
      tokensGenerated: z.number(),
      inferenceMs: z.number(),
    }),
  },
  async (input) => {
    const config = LOCAL_MODELS['nemotron-omni'];
    const result = await ollamaGenerate(config.model, input.prompt, {
      images: input.imageBase64 ? [input.imageBase64] : undefined,
      system: input.systemPrompt,
      temperature: input.temperature,
      format: input.structuredOutput ? 'json' : undefined,
    });

    return {
      response: result.response,
      model: result.model,
      tier: config.tier,
      tokensGenerated: result.evalCount,
      inferenceMs: result.totalDurationMs,
    };
  }
);

// ─── Deep Reasoning Tool (DeepSeek V4) ───────────────────────────────────────

export const deepReasonTool = ai.defineTool(
  {
    name: 'localDeepReason',
    description:
      'Run deep reasoning locally on RTX 4090 using DeepSeek R1 32B (distilled). ' +
      'Top-tier agentic reasoning approaching O3/Gemini 2.5 Pro. ' +
      'Competitive with frontier cloud models. Fully sovereign.',
    inputSchema: z.object({
      prompt: z.string().describe('Complex reasoning or code generation prompt'),
      systemPrompt: z.string().optional(),
      temperature: z.number().min(0).max(2).optional().default(0.3),
      structuredOutput: z.boolean().optional().default(false),
    }),
    outputSchema: z.object({
      response: z.string(),
      model: z.string(),
      tier: z.string(),
      tokensGenerated: z.number(),
      inferenceMs: z.number(),
    }),
  },
  async (input) => {
    const config = LOCAL_MODELS['deepseek-reasoning'];
    const result = await ollamaGenerate(config.model, input.prompt, {
      system: input.systemPrompt,
      temperature: input.temperature,
      format: input.structuredOutput ? 'json' : undefined,
    });

    return {
      response: result.response,
      model: result.model,
      tier: config.tier,
      tokensGenerated: result.evalCount,
      inferenceMs: result.totalDurationMs,
    };
  }
);

// ─── Fast Reasoning Tool (DeepSeek V4 7B) ────────────────────────────────────

export const fastReasonTool = ai.defineTool(
  {
    name: 'localFastReason',
    description:
      'Run fast reasoning locally using DeepSeek R1 8B (R1-0528-Qwen3-8B distilled). ' +
      'For real-time agentic loops where latency matters more than max quality. ' +
      'Fits entirely in VRAM — 5.2GB.',
    inputSchema: z.object({
      prompt: z.string(),
      temperature: z.number().min(0).max(2).optional().default(0.5),
    }),
    outputSchema: z.object({
      response: z.string(),
      model: z.string(),
      tier: z.string(),
      tokensGenerated: z.number(),
      inferenceMs: z.number(),
    }),
  },
  async (input) => {
    const config = LOCAL_MODELS['deepseek-reasoning-fast'];
    const result = await ollamaGenerate(config.model, input.prompt, {
      temperature: input.temperature,
    });

    return {
      response: result.response,
      model: result.model,
      tier: config.tier,
      tokensGenerated: result.evalCount,
      inferenceMs: result.totalDurationMs,
    };
  }
);

// ─── Auto-Tier Selector ──────────────────────────────────────────────────────

export const autoTierReasonTool = ai.defineTool(
  {
    name: 'localAutoReason',
    description:
      'Automatically select the best local model tier based on task characteristics. ' +
      'Routes to Nemotron 3 (multimodal), DeepSeek R1 32B (deep reasoning), or DeepSeek R1 8B (fast) ' +
      'based on whether the task involves images, requires deep reasoning, or needs speed.',
    inputSchema: z.object({
      prompt: z.string(),
      hasImage: z.boolean().optional().default(false),
      requiresDeepReasoning: z.boolean().optional().default(false),
      prioritizeSpeed: z.boolean().optional().default(false),
      imageBase64: z.string().optional(),
      temperature: z.number().min(0).max(2).optional().default(0.5),
    }),
    outputSchema: z.object({
      response: z.string(),
      selectedModel: z.string(),
      selectedTier: z.string(),
      selectionReason: z.string(),
      tokensGenerated: z.number(),
      inferenceMs: z.number(),
    }),
  },
  async (input) => {
    let selectedKey: string;
    let reason: string;

    if (input.hasImage || input.imageBase64) {
      selectedKey = 'nemotron-omni';
      reason = 'Image input detected — routing to Nemotron 3 multimodal';
    } else if (input.requiresDeepReasoning && !input.prioritizeSpeed) {
      selectedKey = 'deepseek-reasoning';
      reason = 'Deep reasoning requested — routing to DeepSeek R1 32B';
    } else if (input.prioritizeSpeed) {
      selectedKey = 'deepseek-reasoning-fast';
      reason = 'Speed priority — routing to DeepSeek R1 8B distilled';
    } else {
      selectedKey = 'deepseek-reasoning-fast';
      reason = 'Default routing — DeepSeek R1 8B for balanced performance';
    }

    const config = LOCAL_MODELS[selectedKey];
    const result = await ollamaGenerate(config.model, input.prompt, {
      images: input.imageBase64 ? [input.imageBase64] : undefined,
      temperature: input.temperature,
    });

    return {
      response: result.response,
      selectedModel: result.model,
      selectedTier: config.tier,
      selectionReason: reason,
      tokensGenerated: result.evalCount,
      inferenceMs: result.totalDurationMs,
    };
  }
);
