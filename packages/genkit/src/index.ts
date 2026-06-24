/**
 * Creative Liberation Engine v5 — Genkit Unified Provider Orchestration
 *
 * The single source of truth for all AI model interactions across
 * the Creative Liberation Engine ecosystem. Replaces hand-rolled provider
 * wrappers with production-ready Genkit plugins.
 *
 * Constitutional Compliance: Article II (Sovereignty), Article III (Human Supremacy)
 */

export { ai, LOCAL_MODEL_IDS } from './ai.js';


// ---------------------------------------------------------------------------
// Re-exports for consumers
// ---------------------------------------------------------------------------

export { googleAI } from '@genkit-ai/google-genai';
export { anthropic } from '@genkit-ai/anthropic';
export { openAI } from '@genkit-ai/compat-oai/openai';
export { deepSeek } from '@genkit-ai/compat-oai/deepseek';
export { xAI } from '@genkit-ai/compat-oai/xai';
export { ollama } from 'genkitx-ollama';
export { z } from 'genkit';
export { generateWithFallback, FALLBACK_CHAINS } from './middleware/circuit-breaker.js';
export { generateWithCache } from './middleware/semantic-cache.js';
// Model registry — capability tiers, env-driven, no version strings in code
export { resolveModel, isLocalTier, logModelRegistry, MODEL_REGISTRY } from './config/model-registry.js';
export type { ModelTier, CloudTier, LocalTier } from './config/model-registry.js';
// Smart model router — classify → tier → model
export { smartRoute, logRouting } from './middleware/smart-router.js';
export type { RoutingDecision } from './middleware/smart-router.js';
// Local Ollama providers — sovereignty layer
export { localGenerate, localStream, checkOllamaHealth, LOCAL_MODELS } from './local-providers.js';
export type { LocalModelCapability } from './local-providers.js';
// NVIDIA NIM & Local AI Developer Tools
export { nvidiaNIM, checkNvidiaHealth, wrapWithClawPrompt, executeWithClawPlanning, openShellExecute, NVIDIA_MODELS } from './plugins/nvidia.js';
export type { NvidiaConfig, NvidiaModelId, OpenShellExecutionResult } from './plugins/nvidia.js';
// Smart VRAM-aware model loading — priority eviction, predictive preload
export { SmartModelLoader, smartLoader, loadCodeModel, loadFastModel, loadReasoningModel, loadVisionModel, loadMultimodalModel, loadEmbedModel } from './middleware/smart-model-loader.js';
export type { ModelProfile, ModelPriority, ModelCapability, LoaderConfig } from './middleware/smart-model-loader.js';

// ── WS-2: Post-RAG Knowledge Fabric Tools ─────────────────────────────────
export { compileKnowledgeTool, queryCompiledContextTool, findStaleKnowledgeTool } from './tools/knowledge-fabric-tools.js';
// ── WS-3: Spatial/Video Pipeline Tools ────────────────────────────────────
export { estimateDepthTool, buildSceneGraphTool, querySpatialTool, editVideoTool, generateVideoTool, syncMetaHumanTool } from './tools/spatial-pipeline-tools.js';
// ── WS-6: Local Multimodal Inference Tools ────────────────────────────────
export { multimodalReasonTool, deepReasonTool, fastReasonTool, autoTierReasonTool } from './tools/local-inference-tools.js';

// Note: Flow imports are handled in server.ts only to avoid ESM circular dependencies.
// Do NOT re-export flows from this index as they import `ai` from this module.
