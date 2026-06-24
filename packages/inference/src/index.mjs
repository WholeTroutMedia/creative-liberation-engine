/**
 * @cle/inference — V6 Inference Orchestration
 *
 * Provides unified access to all inference backends:
 * - Genkit (Google AI, Anthropic, OpenAI, Perplexity)
 * - Ollama (local sovereign inference)
 * - Model arbitrage (intelligent routing based on task, cost, latency)
 *
 * @capabilityIds cap_genkit_inference, cap_model_arbitrage, cap_ollama_mcp
 */

export { createInferenceClient, generate, embed } from './client.mjs';
export { ModelArbitrage, selectModel, MODEL_TIERS } from './arbitrage.mjs';
export { OllamaClient, listLocalModels, pullModel } from './ollama.mjs';
