/**
 * Live Model Scorecard + Provider Watch — Phase C HELIX B
 * Maintains a real-time capability matrix of all available models.
 */
import type { ScorecardEntry, Modality, ContextSize, ReasoningTier, SpeedTier } from './capability-schema.js';

const PROVIDER_ENDPOINTS: Record<string, string> = {
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
  anthropic: 'https://api.anthropic.com/v1/models',
  openai: 'https://api.openai.com/v1/models',
};

export class ModelScorecard {
  private entries: Map<string, ScorecardEntry> = new Map();
  private pollIntervalMs = 3600_000; // 1 hour
  private pollTimer?: ReturnType<typeof setInterval>;

  constructor(initialEntries?: ScorecardEntry[]) {
    if (initialEntries) {
      for (const e of initialEntries) this.entries.set(e.model_id, e);
    }
  }

  /** Get the best model matching a capability requirement */
  findBestMatch(opts: {
    reasoning?: ReasoningTier;
    speed?: SpeedTier;
    context?: ContextSize;
    modality?: Modality[];
    maxCost?: number;
  }): ScorecardEntry | undefined {
    let candidates = [...this.entries.values()].filter(e => e.status === 'active');
    if (opts.reasoning) candidates = candidates.filter(e => this.tierScore(e.capabilities.reasoning) >= this.tierScore(opts.reasoning!));
    if (opts.speed) candidates = candidates.filter(e => this.speedScore(e.capabilities.speed) >= this.speedScore(opts.speed!));
    if (opts.modality) candidates = candidates.filter(e => opts.modality!.every(m => e.capabilities.modality.includes(m)));
    if (opts.maxCost) candidates = candidates.filter(e => e.cost_per_1k_tokens <= opts.maxCost!);
    candidates.sort((a, b) => b.quality_score - a.quality_score);
    return candidates[0];
  }

  /** Start polling providers for new model releases */
  startProviderWatch(apiKeys: Record<string, string>): void {
    this.pollTimer = setInterval(() => this.pollProviders(apiKeys), this.pollIntervalMs);
    this.pollProviders(apiKeys); // immediate first poll
  }

  stopProviderWatch(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  private async pollProviders(apiKeys: Record<string, string>): Promise<void> {
    for (const [provider, endpoint] of Object.entries(PROVIDER_ENDPOINTS)) {
      const key = apiKeys[provider];
      if (!key) continue;
      try {
        const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok) continue;
        const data = await res.json() as { models?: Array<{ id: string; name?: string }> };
        const models = data.models ?? [];
        for (const model of models) {
          const id = model.id ?? model.name ?? '';
          if (!this.entries.has(id)) {
            console.log(`[SCORECARD] New model discovered: ${id} from ${provider}`);
            this.entries.set(id, this.createPendingEntry(id, provider));
          }
        }
      } catch (err) {
        console.warn(`[SCORECARD] Failed to poll ${provider}:`, err);
      }
    }
  }

  private createPendingEntry(modelId: string, provider: string): ScorecardEntry {
    return {
      model_id: modelId, provider,
      capabilities: { reasoning: 'standard', speed: 'standard', context_size: 'medium', modality: ['text'], privacy: 'cloud_ok' },
      cost_per_1k_tokens: 0, latency_p50: 0, latency_p99: 0,
      quality_score: 0,
      quality_dimensions: { reasoning_accuracy: 0, creative_quality: 0, instruction_following: 0, code_generation: 0, factual_accuracy: 0, speed_score: 0 },
      last_benchmarked: 'never', status: 'benchmarking', uptime_30d: 0,
    };
  }

  updateEntry(modelId: string, update: Partial<ScorecardEntry>): void {
    const existing = this.entries.get(modelId);
    if (existing) this.entries.set(modelId, { ...existing, ...update });
  }

  /** Apply semantic prediction error feedback (0.0=perfect, 1.0=divergent). Penalizes bad predictors over time. */
  applyPredictionFeedback(modelId: string, errorScore: number): void {
    const entry = this.entries.get(modelId);
    if (!entry) return;

    // Decay penalty: error 1.0 = -5 points, error 0.0 = +1 point. Max score = 100, Min = 0
    const delta = errorScore > 0.5 ? -Math.round(errorScore * 5) : 1;
    
    // Smooth the adjustment so one bad prediction doesn't tank the score, but consecutive bad ones will.
    const newScore = Math.max(0, Math.min(100, entry.quality_score + delta));
    
    // Also tweak reasoning_accuracy dimension as a proxy for predictability
    const newReasoning = Math.max(0, Math.min(100, entry.quality_dimensions.reasoning_accuracy + delta));

    this.entries.set(modelId, { 
      ...entry, 
      quality_score: newScore,
      quality_dimensions: { ...entry.quality_dimensions, reasoning_accuracy: newReasoning }
    });

    console.log(`[SCORECARD] Prediction feedback for ${modelId}: error=${errorScore.toFixed(2)} -> quality_score=${newScore} (${delta > 0 ? '+' : ''}${delta})`);
  }

  getAll(): ScorecardEntry[] { return [...this.entries.values()]; }
  getActive(): ScorecardEntry[] { return this.getAll().filter(e => e.status === 'active'); }
  getPending(): ScorecardEntry[] { return this.getAll().filter(e => e.status === 'benchmarking'); }

  private tierScore(t: ReasoningTier): number {
    return { frontier: 4, efficient: 3, standard: 2, minimal: 1 }[t] ?? 0;
  }
  private speedScore(t: SpeedTier): number {
    return { realtime: 4, fast: 3, standard: 2, batch: 1 }[t] ?? 0;
  }
}

export const modelScorecard = new ModelScorecard();