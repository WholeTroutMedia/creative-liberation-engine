/**
 * Dynamic LLM Router Module — Helix α
 * Extension for orchestration service.
 * Routes inference requests to optimal model based on task type, latency, cost, capability.
 */
import { randomUUID as uuidv4 } from 'crypto';

export interface ModelEndpoint {
  model_id: string;
  name: string;
  provider: 'local' | 'ollama' | 'vllm' | 'openai' | 'anthropic' | 'google';
  url: string;
  capabilities: string[];
  max_tokens: number;
  cost_per_1k_tokens: number;
  avg_latency_ms: number;
  energy_per_1k_tokens_wh: number;
  status: 'online' | 'offline' | 'degraded';
  priority: number;
}

export interface RouteDecision {
  decision_id: string;
  task_type: string;
  selected_model: string;
  reason: string;
  alternatives: string[];
  latency_ms: number;
}

const endpoints: ModelEndpoint[] = [
  { model_id: 'isaac-qwen32b', name: 'Isaac Qwen 2.5 32B', provider: 'vllm', url: 'http://127.0.0.1:8000', capabilities: ['code', 'reasoning', 'chat'], max_tokens: 32768, cost_per_1k_tokens: 0, avg_latency_ms: 800, energy_per_1k_tokens_wh: 0.15, status: 'online', priority: 1 },
  { model_id: 'ollama-llama3', name: 'Ollama Llama 3.1', provider: 'ollama', url: 'http://127.0.0.1:11434', capabilities: ['chat', 'reasoning', 'summarization'], max_tokens: 8192, cost_per_1k_tokens: 0, avg_latency_ms: 500, energy_per_1k_tokens_wh: 0.05, status: 'online', priority: 2 },
  { model_id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', url: 'https://generativelanguage.googleapis.com', capabilities: ['code', 'reasoning', 'vision', 'chat', 'long_context'], max_tokens: 1000000, cost_per_1k_tokens: 1.25, avg_latency_ms: 1200, energy_per_1k_tokens_wh: 0.40, status: 'online', priority: 3 },
  { model_id: 'claude-sonnet', name: 'Claude 4 Sonnet', provider: 'anthropic', url: 'https://api.anthropic.com', capabilities: ['code', 'reasoning', 'chat', 'analysis'], max_tokens: 200000, cost_per_1k_tokens: 3.0, avg_latency_ms: 1500, energy_per_1k_tokens_wh: 0.50, status: 'online', priority: 4 },
];

const decisions: RouteDecision[] = [];

export function routeRequest(taskType: string, requiredCapabilities: string[], maxLatency?: number, preferLocal = true, optimizeEnergy = true): RouteDecision {
  const start = Date.now();
  const eligible = endpoints
    .filter(e => e.status === 'online')
    .filter(e => requiredCapabilities.every(c => e.capabilities.includes(c)))
    .filter(e => !maxLatency || e.avg_latency_ms <= maxLatency);

  let sorted = eligible.sort((a, b) => {
    if (optimizeEnergy) {
      if (a.energy_per_1k_tokens_wh !== b.energy_per_1k_tokens_wh) {
        return a.energy_per_1k_tokens_wh - b.energy_per_1k_tokens_wh;
      }
    }
    if (preferLocal) {
      const aLocal = a.provider === 'local' || a.provider === 'ollama' || a.provider === 'vllm' ? 0 : 1;
      const bLocal = b.provider === 'local' || b.provider === 'ollama' || b.provider === 'vllm' ? 0 : 1;
      if (aLocal !== bLocal) return aLocal - bLocal;
    }
    if (a.cost_per_1k_tokens !== b.cost_per_1k_tokens) return a.cost_per_1k_tokens - b.cost_per_1k_tokens;
    return a.priority - b.priority;
  });

  const selected = sorted[0] || endpoints[0];
  
  let reasonStr = preferLocal && selected.cost_per_1k_tokens === 0 ? 'sovereign_local_first' : 'best_available';
  if (optimizeEnergy && sorted.length > 1 && selected.energy_per_1k_tokens_wh < sorted[1].energy_per_1k_tokens_wh) {
    reasonStr = 'most_energy_efficient';
  }

  const decision: RouteDecision = {
    decision_id: uuidv4(), task_type: taskType, selected_model: selected.model_id,
    reason: reasonStr,
    alternatives: sorted.slice(1, 4).map(e => e.model_id),
    latency_ms: Date.now() - start,
  };
  decisions.push(decision);
  return decision;
}

export function getEndpoints() { return endpoints; }
export function updateEndpointStatus(modelId: string, status: ModelEndpoint['status']) {
  const ep = endpoints.find(e => e.model_id === modelId);
  if (ep) ep.status = status;
}
export function getRecentDecisions(limit = 50) { return decisions.slice(-limit); }
