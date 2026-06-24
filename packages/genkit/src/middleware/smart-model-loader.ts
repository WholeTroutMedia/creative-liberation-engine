/**
 * SmartModelLoader — VRAM-aware model lifecycle manager for RTX 4090.
 *
 * ARCHITECTURE:
 *   NAS (127.0.0.1)         = brain, orchestrator, runs Genkit + all services
 *   Workstation (192.168.2.20) = GPU muscle, runs Ollama + RTX 4090
 *
 * This loader runs ON THE NAS and manages the workstation's GPU remotely
 * over LAN via Ollama's HTTP API. The workstation is a compute node,
 * not the operating center.
 *
 * Key behaviors:
 *   1. VRAM budget tracking — never exceed 22GB (2GB headroom for OS/CUDA)
 *   2. Priority tiers — embed/fast models are "sticky", large models are "transient"
 *   3. Predictive preloading — pre-warm models based on recent usage patterns
 *   4. Cold-load awareness — tracks load times per model for scheduling
 *   5. SATA upgrade path — when faster storage arrives, cold-load penalty drops
 *
 * Constitutional: Article II (Sovereignty — local-first inference)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelProfile {
  /** Ollama model identifier */
  name: string;
  /** VRAM required when loaded (MB) */
  vramMB: number;
  /** Disk size (MB) — affects cold-load time */
  diskMB: number;
  /** Priority tier: lower = evicted first */
  priority: ModelPriority;
  /** Capabilities this model serves */
  capabilities: ModelCapability[];
  /** Average cold-load time in seconds (updated at runtime) */
  avgLoadTimeSec: number;
  /** Whether model is currently loaded in Ollama */
  loaded: boolean;
  /** Last time this model was used (epoch ms) */
  lastUsed: number;
  /** Total invocations this session */
  invocations: number;
}

export type ModelPriority = 'critical' | 'high' | 'medium' | 'low' | 'transient';
export type ModelCapability =
  | 'embed'
  | 'code'
  | 'fast-chat'
  | 'reasoning'
  | 'vision'
  | 'multimodal'
  | 'agent'
  | 'large-reasoning';

export interface LoaderConfig {
  /** Total VRAM budget in MB (default: 22000 for RTX 4090 with 2GB headroom) */
  vramBudgetMB: number;
  /**
   * Ollama API endpoint — points to WORKSTATION, not localhost.
   * NAS orchestrates, workstation runs inference.
   * Default: http://192.168.2.20:11434
   */
  ollamaHost: string;
  /** Minimum idle time before a model becomes eviction-eligible (ms) */
  evictionIdleMs: number;
  /** Enable predictive preloading based on usage patterns */
  predictivePreload: boolean;
  /** Storage tier on the WORKSTATION — affects cold-load time estimates */
  storageTier: 'nvme' | 'sata-ssd' | 'hdd';
  /** Path to Ollama model storage ON THE WORKSTATION (OLLAMA_MODELS env var) */
  modelStoragePath: string;
  /** NAS mirror path for model backup/cold-load fallback */
  nasModelPath: string;
}

// ---------------------------------------------------------------------------
// Default model fleet profiles (RTX 4090 workstation)
// ---------------------------------------------------------------------------

const DEFAULT_PROFILES: Omit<ModelProfile, 'loaded' | 'lastUsed' | 'invocations'>[] = [
  // ── Always-resident (critical) ──────────────────────────────────────────
  {
    name: 'nomic-embed-text:latest',
    vramMB: 300,
    diskMB: 274,
    priority: 'critical',
    capabilities: ['embed'],
    avgLoadTimeSec: 1,
  },
  // ── High priority (kept warm when possible) ─────────────────────────────
  {
    name: 'gemma4:e2b',
    vramMB: 4500,
    diskMB: 7200,
    priority: 'high',
    capabilities: ['fast-chat'],
    avgLoadTimeSec: 3,
  },
  {
    name: 'qwen3:1.7b',
    vramMB: 1500,
    diskMB: 1400,
    priority: 'high',
    capabilities: ['fast-chat', 'agent'],
    avgLoadTimeSec: 2,
  },
  // ── Medium priority ─────────────────────────────────────────────────────
  {
    name: 'nemotron3:33b',
    vramMB: 20000,  // 33B MoE — needs significant VRAM
    diskMB: 27000,
    priority: 'medium',
    capabilities: ['multimodal', 'vision', 'agent'],
    avgLoadTimeSec: 12,
  },
  {
    name: 'qwen3:14b',
    vramMB: 9500,
    diskMB: 9300,
    priority: 'medium',
    capabilities: ['reasoning', 'code'],
    avgLoadTimeSec: 8,
  },
  {
    name: 'gemma4:e4b',
    vramMB: 6000,
    diskMB: 9600,
    priority: 'medium',
    capabilities: ['fast-chat', 'vision'],
    avgLoadTimeSec: 5,
  },
  {
    name: 'phi4-mini:latest',
    vramMB: 2500,
    diskMB: 2500,
    priority: 'medium',
    capabilities: ['fast-chat', 'reasoning'],
    avgLoadTimeSec: 2,
  },
  // ── Low priority (load on demand) ───────────────────────────────────────
  {
    name: 'gemma4:26b',
    vramMB: 17000,
    diskMB: 17000,
    priority: 'low',
    capabilities: ['reasoning', 'vision', 'large-reasoning'],
    avgLoadTimeSec: 12,
  },
  {
    name: 'qwen2.5-coder:32b',
    vramMB: 19000,
    diskMB: 19000,
    priority: 'low',
    capabilities: ['code', 'large-reasoning'],
    avgLoadTimeSec: 15,
  },
  {
    name: 'deepseek-r1:8b',
    vramMB: 5500,
    diskMB: 5200,
    priority: 'medium',
    capabilities: ['reasoning'],
    avgLoadTimeSec: 4,
  },
  {
    name: 'deepseek-r1:32b',
    vramMB: 20000,
    diskMB: 20000,
    priority: 'low',
    capabilities: ['reasoning', 'large-reasoning'],
    avgLoadTimeSec: 14,
  },
  {
    name: 'deepseek-v4-flash:cloud',
    vramMB: 0,       // Cloud model — no local VRAM
    diskMB: 0,
    priority: 'low',
    capabilities: ['reasoning', 'large-reasoning'],
    avgLoadTimeSec: 2, // Network latency only
  },
  {
    name: 'llava:34b',
    vramMB: 20000,
    diskMB: 20000,
    priority: 'low',
    capabilities: ['vision', 'multimodal'],
    avgLoadTimeSec: 16,
  },
  // ── Transient (offload immediately after use) ───────────────────────────
  {
    name: 'llama3.3:70b-instruct-q4_K_M',
    vramMB: 42000, // exceeds VRAM — needs CPU offload
    diskMB: 42000,
    priority: 'transient',
    capabilities: ['large-reasoning'],
    avgLoadTimeSec: 45,
  },
];

// ---------------------------------------------------------------------------
// Storage tier multipliers for cold-load time estimation
// ---------------------------------------------------------------------------

const STORAGE_MULTIPLIERS: Record<LoaderConfig['storageTier'], number> = {
  'nvme': 1.0,       // Baseline — current NVMe
  'sata-ssd': 1.8,   // ~1.8x slower than NVMe (pending UGREEN SATA upgrade)
  'hdd': 6.0,        // ~6x slower (NAS spinning disks)
};

// ---------------------------------------------------------------------------
// SmartModelLoader
// ---------------------------------------------------------------------------

export class SmartModelLoader {
  private profiles: Map<string, ModelProfile> = new Map();
  private config: LoaderConfig;
  private usageHistory: Array<{ model: string; timestamp: number; capability: ModelCapability }> = [];

  constructor(config?: Partial<LoaderConfig>) {
    this.config = {
      vramBudgetMB: config?.vramBudgetMB ?? 22000,
      // NAS → Workstation: default to workstation LAN IP, not localhost
      ollamaHost: config?.ollamaHost ?? process.env.OLLAMA_HOST ?? 'http://192.168.2.20:11434',
      evictionIdleMs: config?.evictionIdleMs ?? 5 * 60 * 1000, // 5 min default
      predictivePreload: config?.predictivePreload ?? true,
      storageTier: config?.storageTier ?? 'nvme',
      modelStoragePath: config?.modelStoragePath ?? 'D:\\Google Antigravity\\models', // on workstation
      nasModelPath: config?.nasModelPath ?? '/app/creative-liberation-engine/models',
    };

    // Initialize profiles
    for (const p of DEFAULT_PROFILES) {
      this.profiles.set(p.name, {
        ...p,
        loaded: false,
        lastUsed: 0,
        invocations: 0,
      });
    }
  }

  // ── Core API ────────────────────────────────────────────────────────────

  /**
   * Ensure a model is loaded and ready. Handles eviction if needed.
   * Returns the model name (passthrough for chaining).
   */
  async ensureLoaded(modelName: string, capability?: ModelCapability): Promise<string> {
    const profile = this.profiles.get(modelName);
    if (!profile) {
      console.warn(`[SmartLoader] Unknown model: ${modelName} — loading without profile`);
      await this.ollamaLoad(modelName);
      return modelName;
    }

    // Track usage
    profile.lastUsed = Date.now();
    profile.invocations++;
    if (capability) {
      this.usageHistory.push({ model: modelName, timestamp: Date.now(), capability });
      // Keep history trimmed to last 500 entries
      if (this.usageHistory.length > 500) {
        this.usageHistory = this.usageHistory.slice(-500);
      }
    }

    if (profile.loaded) {
      return modelName;
    }

    // Check if we have room
    const currentVRAM = this.getLoadedVRAM();
    const needed = profile.vramMB;

    if (currentVRAM + needed > this.config.vramBudgetMB) {
      await this.evictForSpace(needed);
    }

    // Load the model
    const loadStart = Date.now();
    await this.ollamaLoad(modelName);
    const loadTime = (Date.now() - loadStart) / 1000;

    // Update load time with exponential moving average
    profile.avgLoadTimeSec = profile.avgLoadTimeSec > 0
      ? profile.avgLoadTimeSec * 0.7 + loadTime * 0.3
      : loadTime;
    profile.loaded = true;

    console.log(
      `[SmartLoader] ✓ Loaded ${modelName} in ${loadTime.toFixed(1)}s ` +
      `(VRAM: ${this.getLoadedVRAM()}/${this.config.vramBudgetMB} MB)`
    );

    return modelName;
  }

  /**
   * Find the best available model for a given capability.
   * Prefers already-loaded models, then by priority tier.
   */
  async resolveForCapability(capability: ModelCapability): Promise<string> {
    const candidates = Array.from(this.profiles.values())
      .filter(p => p.capabilities.includes(capability))
      .sort((a, b) => {
        // Prefer already loaded
        if (a.loaded && !b.loaded) return -1;
        if (!a.loaded && b.loaded) return 1;
        // Then by priority (critical > high > medium > low > transient)
        const priorityOrder: Record<ModelPriority, number> = {
          critical: 0, high: 1, medium: 2, low: 3, transient: 4,
        };
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        // Then by VRAM (prefer smaller for faster load)
        return a.vramMB - b.vramMB;
      });

    if (candidates.length === 0) {
      throw new Error(`[SmartLoader] No model available for capability: ${capability}`);
    }

    const chosen = candidates[0];
    return this.ensureLoaded(chosen.name, capability);
  }

  /**
   * Preload models based on predicted upcoming needs.
   * Called on idle or at session start.
   */
  async preloadPredicted(): Promise<void> {
    if (!this.config.predictivePreload) return;

    // Analyze recent usage — find top 3 capabilities used in last 30 min
    const recentCutoff = Date.now() - 30 * 60 * 1000;
    const recentCaps = this.usageHistory
      .filter(h => h.timestamp > recentCutoff)
      .reduce((acc, h) => {
        acc.set(h.capability, (acc.get(h.capability) ?? 0) + 1);
        return acc;
      }, new Map<ModelCapability, number>());

    const topCaps = Array.from(recentCaps.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cap]) => cap);

    // Always include embed (critical)
    if (!topCaps.includes('embed')) topCaps.unshift('embed');

    for (const cap of topCaps) {
      try {
        await this.resolveForCapability(cap);
      } catch (e) {
        console.warn(`[SmartLoader] Preload failed for ${cap}:`, e);
      }
    }
  }

  /**
   * Get current loader status for telemetry/dashboard.
   */
  getStatus(): {
    loadedModels: Array<{ name: string; vramMB: number; priority: ModelPriority; idleSec: number }>;
    totalVRAM: number;
    budgetMB: number;
    availableMB: number;
    storageTier: string;
    profileCount: number;
  } {
    const now = Date.now();
    const loaded = Array.from(this.profiles.values())
      .filter(p => p.loaded)
      .map(p => ({
        name: p.name,
        vramMB: p.vramMB,
        priority: p.priority,
        idleSec: Math.round((now - p.lastUsed) / 1000),
      }));

    const totalVRAM = this.getLoadedVRAM();
    return {
      loadedModels: loaded,
      totalVRAM,
      budgetMB: this.config.vramBudgetMB,
      availableMB: this.config.vramBudgetMB - totalVRAM,
      storageTier: this.config.storageTier,
      profileCount: this.profiles.size,
    };
  }

  /**
   * Estimate cold-load time for a model given current storage tier.
   */
  estimateLoadTime(modelName: string): number {
    const profile = this.profiles.get(modelName);
    if (!profile) return 10; // Unknown — conservative estimate
    return profile.avgLoadTimeSec * STORAGE_MULTIPLIERS[this.config.storageTier];
  }

  /**
   * Update storage tier (call this when SATA SSD arrives and is installed).
   */
  setStorageTier(tier: LoaderConfig['storageTier']): void {
    this.config.storageTier = tier;
    console.log(`[SmartLoader] Storage tier updated to: ${tier}`);
  }

  /**
   * Register a new model profile at runtime (e.g., after ollama pull).
   */
  registerModel(profile: Omit<ModelProfile, 'loaded' | 'lastUsed' | 'invocations'>): void {
    this.profiles.set(profile.name, {
      ...profile,
      loaded: false,
      lastUsed: 0,
      invocations: 0,
    });
    console.log(`[SmartLoader] Registered model: ${profile.name} (${profile.priority}, ${profile.vramMB}MB VRAM)`);
  }

  /**
   * Sync loaded state from Ollama's actual process list.
   */
  async syncFromOllama(): Promise<void> {
    try {
      const resp = await fetch(`${this.config.ollamaHost}/api/ps`);
      if (!resp.ok) return;
      const data = await resp.json() as { models?: Array<{ name: string; size_vram?: number }> };

      // Reset all to unloaded
      for (const p of this.profiles.values()) p.loaded = false;

      // Mark actually loaded ones
      for (const m of data.models ?? []) {
        const profile = this.profiles.get(m.name);
        if (profile) {
          profile.loaded = true;
          if (m.size_vram) {
            profile.vramMB = Math.round(m.size_vram / 1024 / 1024);
          }
        }
      }
    } catch (e) {
      console.warn('[SmartLoader] Could not sync from Ollama:', e);
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private getLoadedVRAM(): number {
    let total = 0;
    for (const p of this.profiles.values()) {
      if (p.loaded) total += p.vramMB;
    }
    return total;
  }

  /**
   * Evict models until `neededMB` is freed.
   * Eviction order: transient first, then by idle time within priority tier.
   */
  private async evictForSpace(neededMB: number): Promise<void> {
    const currentVRAM = this.getLoadedVRAM();
    let target = currentVRAM + neededMB - this.config.vramBudgetMB;
    if (target <= 0) return;

    const now = Date.now();
    const priorityOrder: Record<ModelPriority, number> = {
      transient: 0, low: 1, medium: 2, high: 3, critical: 4,
    };

    // Build eviction candidates
    const candidates = Array.from(this.profiles.values())
      .filter(p => p.loaded && p.priority !== 'critical')
      .sort((a, b) => {
        // Evict lowest priority first
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        // Within same tier, evict longest-idle first
        return a.lastUsed - b.lastUsed;
      });

    for (const candidate of candidates) {
      if (target <= 0) break;

      // Don't evict recently used models unless they're transient
      if (candidate.priority !== 'transient') {
        const idleMs = now - candidate.lastUsed;
        if (idleMs < this.config.evictionIdleMs && candidate.lastUsed > 0) {
          continue;
        }
      }

      console.log(
        `[SmartLoader] Evicting ${candidate.name} ` +
        `(${candidate.priority}, idle ${Math.round((now - candidate.lastUsed) / 1000)}s, ` +
        `freeing ${candidate.vramMB}MB)`
      );

      await this.ollamaUnload(candidate.name);
      candidate.loaded = false;
      target -= candidate.vramMB;
    }

    if (target > 0) {
      console.warn(
        `[SmartLoader] ⚠ Could not free enough VRAM — still need ${target}MB. ` +
        `Model may use CPU offload.`
      );
    }
  }

  private async ollamaLoad(model: string): Promise<void> {
    try {
      const resp = await fetch(`${this.config.ollamaHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: '', keep_alive: '10m' }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Ollama load failed (${resp.status}): ${text}`);
      }
      // Consume the response stream
      const reader = resp.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
    } catch (e) {
      console.error(`[SmartLoader] Failed to load ${model}:`, e);
      throw e;
    }
  }

  private async ollamaUnload(model: string): Promise<void> {
    try {
      await fetch(`${this.config.ollamaHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: '', keep_alive: '0' }),
      });
    } catch (e) {
      console.warn(`[SmartLoader] Failed to unload ${model}:`, e);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

export const smartLoader = new SmartModelLoader();

// ---------------------------------------------------------------------------
// Convenience exports for common patterns
// ---------------------------------------------------------------------------

/** Load best model for coding tasks */
export const loadCodeModel = () => smartLoader.resolveForCapability('code');

/** Load best model for fast chat */
export const loadFastModel = () => smartLoader.resolveForCapability('fast-chat');

/** Load best model for deep reasoning */
export const loadReasoningModel = () => smartLoader.resolveForCapability('reasoning');

/** Load best model for vision/multimodal */
export const loadVisionModel = () => smartLoader.resolveForCapability('vision');

/** Load best model for multimodal agent tasks */
export const loadMultimodalModel = () => smartLoader.resolveForCapability('multimodal');

/** Load embedding model (always-resident) */
export const loadEmbedModel = () => smartLoader.resolveForCapability('embed');
