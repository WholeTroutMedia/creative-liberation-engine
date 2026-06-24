/**
 * Model Arbitrage — intelligent model selection based on task requirements.
 *
 * Routes requests to the optimal model considering:
 * - Task complexity (simple → local Ollama, complex → cloud API)
 * - Cost constraints (budget-aware routing)
 * - Latency requirements (real-time → local, batch → cloud)
 * - Sovereignty preferences (local-first when SOVEREIGN_MODE=true)
 *
 * @capabilityId cap_model_arbitrage
 */

import { getConfig, getConfigBool } from '@cle/config';

/** Model tier definitions aligned with models.canonical.json */
export const MODEL_TIERS = {
  SOVEREIGN: 'sovereign',   // Local Ollama — zero external calls
  STANDARD: 'standard',     // Cloud API — standard tier
  PREMIUM: 'premium',       // Cloud API — premium tier (GPT-4, Claude Opus)
  SPECIALIZED: 'specialized', // Task-specific models (embedding, vision)
};

/** Default model routing table */
const ROUTING_TABLE = {
  // Simple tasks → local first
  classify: { sovereign: 'ollama/gemma3:4b', standard: 'googleai/gemini-2.5-flash' },
  summarize: { sovereign: 'ollama/gemma3:12b', standard: 'googleai/gemini-2.5-flash' },
  extract: { sovereign: 'ollama/gemma3:12b', standard: 'googleai/gemini-2.5-flash' },

  // Complex tasks → cloud
  generate: { sovereign: 'ollama/gemma3:27b', standard: 'googleai/gemini-2.5-flash', premium: 'googleai/gemini-2.5-pro' },
  reason: { sovereign: 'ollama/gemma3:27b', standard: 'googleai/gemini-2.5-pro', premium: 'anthropic/claude-sonnet-4-20250514' },
  code: { sovereign: 'ollama/qwen2.5-coder:14b', standard: 'googleai/gemini-2.5-flash', premium: 'anthropic/claude-sonnet-4-20250514' },
  creative: { sovereign: 'ollama/gemma3:27b', standard: 'googleai/gemini-2.5-pro', premium: 'anthropic/claude-sonnet-4-20250514' },

  // Embeddings → always local when possible
  embed: { sovereign: 'ollama/nomic-embed-text', standard: 'googleai/text-embedding-004' },

  // Default fallback
  general: { sovereign: 'ollama/gemma3:12b', standard: 'googleai/gemini-2.5-flash', premium: 'googleai/gemini-2.5-pro' },
};

/**
 * Model Arbitrage engine.
 */
export class ModelArbitrage {
  constructor(opts = {}) {
    this.sovereignMode = opts.sovereignMode ?? getConfigBool('SOVEREIGN_MODE', false);
    this.routingTable = opts.routingTable ?? ROUTING_TABLE;
  }

  /**
   * Select the optimal model for a given task.
   * @param {object} request
   * @param {string} request.task - Task type (classify, summarize, generate, reason, code, creative, embed, general)
   * @param {string} [request.tier] - Force a specific tier (sovereign, standard, premium)
   * @param {boolean} [request.requireLocal] - Force local model
   * @returns {{ model: string, tier: string, reason: string }}
   */
  select(request) {
    const { task = 'general', tier, requireLocal } = request;
    const routes = this.routingTable[task] || this.routingTable.general;

    // Sovereignty override
    if (this.sovereignMode || requireLocal) {
      if (routes.sovereign) {
        return { model: routes.sovereign, tier: MODEL_TIERS.SOVEREIGN, reason: 'sovereign_mode' };
      }
    }

    // Explicit tier
    if (tier && routes[tier]) {
      return { model: routes[tier], tier, reason: 'explicit_tier' };
    }

    // Default: standard tier
    const selectedTier = routes.standard ? 'standard' : 'sovereign';
    return {
      model: routes[selectedTier],
      tier: selectedTier,
      reason: 'default_routing',
    };
  }
}

/** Convenience: select model with default arbitrage */
export function selectModel(request) {
  const arbitrage = new ModelArbitrage();
  return arbitrage.select(request);
}
