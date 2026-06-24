/**
 * packages/model-arbitrage/src/gpu-tier.ts
 * Creative Liberation Engine — GPU Hardware Capability Tier
 *
 * Abstracts the local GPU tier so every ComfyUI workflow, inference call,
 * and model selection can adapt to current and future hardware automatically.
 *
 * Tier detection order:
 *   1. GPU_TIER env var (explicit override — always wins)
 *   2. CUDA_VISIBLE_DEVICES + nvidia-smi detection at runtime
 *   3. Hardcoded default: 'ada' (current workstation RTX 4090)
 *
 * Tier capabilities:
 *   cpu       — CPU-only, no CUDA (fallback / testing)
 *   ada       — RTX 30/40-series (Ada Lovelace). DLSS4, MFG 4x, FP8, NVFP4 coming soon
 *   blackwell — RTX 50-series (Blackwell). DLSS5 Neural Rendering, MFG 6x, NVFP4 native
 *
 * Article VI compliance: GPU tier drives env-var-based model selection, never hardcoded.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type GpuTier = 'cpu' | 'ada' | 'blackwell';

export interface GpuTierCapabilities {
    tier:                  GpuTier;
    /** Human-readable tier label */
    label:                 string;
    /** DLSS generation supported (0 = none) */
    dlssGeneration:        0 | 4 | 5;
    /** Max Multi Frame Generation multiplier available */
    maxMfgMultiplier:      1 | 4 | 6;
    /** Native NVFP4 quantization support */
    supportsNvfp4:         boolean;
    /** FP8 inference support */
    supportsFp8:           boolean;
    /** RTX Neural Shaders (RTXNS) SDK support */
    supportsNeuralShaders: boolean;
    /** RTX Video Super Resolution support */
    supportsVideoSR:       boolean;
    /** DLSS5 Neural Rendering (per-material re-shading) */
    supportsDlss5NeuralRendering: boolean;
    /** Recommended ComfyUI quantization flag for this tier */
    recommendedQuantization: 'none' | 'fp8' | 'nvfp4';
    /** Estimated VRAM savings vs bf16 baseline (0-1) */
    vramSavingsFactor:     number;
    /** Estimated throughput multiplier vs bf16 baseline */
    throughputMultiplier:  number;
}

// ── Tier Definitions ───────────────────────────────────────────────────────────

const TIER_CAPABILITIES: Record<GpuTier, GpuTierCapabilities> = {
    cpu: {
        tier:                        'cpu',
        label:                       'CPU (no CUDA)',
        dlssGeneration:              0,
        maxMfgMultiplier:            1,
        supportsNvfp4:               false,
        supportsFp8:                 false,
        supportsNeuralShaders:       false,
        supportsVideoSR:             false,
        supportsDlss5NeuralRendering: false,
        recommendedQuantization:     'none',
        vramSavingsFactor:           0,
        throughputMultiplier:        0.1,
    },
    ada: {
        tier:                        'ada',
        label:                       'NVIDIA Ada Lovelace (RTX 30/40-series)',
        dlssGeneration:              4,
        maxMfgMultiplier:            4,
        supportsNvfp4:               false,     // NVFP4 is Blackwell-native; partial via software
        supportsFp8:                 true,      // Ada supports FP8 via Transformer Engine
        supportsNeuralShaders:       true,      // RTXNS SDK works on Ada
        supportsVideoSR:             true,      // RTX Video SR available in ComfyUI now
        supportsDlss5NeuralRendering: false,    // Blackwell-only at launch
        recommendedQuantization:     'fp8',
        vramSavingsFactor:           0.40,      // FP8 ≈ 40-60% VRAM savings vs bf16
        throughputMultiplier:        2.0,       // ~2x throughput with FP8 on Ada Tensor Cores
    },
    blackwell: {
        tier:                        'blackwell',
        label:                       'NVIDIA Blackwell (RTX 50-series)',
        dlssGeneration:              5,
        maxMfgMultiplier:            6,
        supportsNvfp4:               true,      // Native NVFP4 — 2.5x faster, 60% less VRAM
        supportsFp8:                 true,
        supportsNeuralShaders:       true,
        supportsVideoSR:             true,
        supportsDlss5NeuralRendering: true,     // Full DLSS5 Neural Rendering
        recommendedQuantization:     'nvfp4',
        vramSavingsFactor:           0.60,      // NVFP4 ≈ 60% VRAM savings
        throughputMultiplier:        2.5,       // NVFP4 ≈ 2.5x throughput
    },
};

// ── Detection ─────────────────────────────────────────────────────────────────

/** GPU architecture family keywords for auto-detection from nvidia-smi output */
const BLACKWELL_PATTERNS = ['RTX 50', 'RTX50', 'GB200', 'GB202', 'GB203', 'B100', 'B200', 'Blackwell'];
const ADA_PATTERNS       = ['RTX 40', 'RTX 30', 'RTX40', 'RTX30', 'Ada', 'Ampere', 'A100', 'A10', 'A6000'];

function detectTierFromGpuName(gpuName: string): GpuTier {
    const upper = gpuName.toUpperCase();
    if (BLACKWELL_PATTERNS.some(p => upper.includes(p.toUpperCase()))) return 'blackwell';
    if (ADA_PATTERNS.some(p => upper.includes(p.toUpperCase())))       return 'ada';
    return 'ada'; // Default: assume Ada (current workstation)
}

// ── GpuTierManager ─────────────────────────────────────────────────────────────

export class GpuTierManager {
    private _detected: GpuTier | null = null;

    /**
     * Get current GPU tier.
     * Order: GPU_TIER env override → auto-detect → default 'ada'
     */
    getTier(): GpuTier {
        if (this._detected) return this._detected;

        // 1. Explicit override
        const envOverride = process.env.GPU_TIER?.toLowerCase() as GpuTier | undefined;
        if (envOverride && TIER_CAPABILITIES[envOverride]) {
            this._detected = envOverride;
            console.log(`[GPU_TIER] 🎯 Tier override via GPU_TIER env: ${envOverride}`);
            return this._detected;
        }

        // 2. Detect from COMFYUI_GPU_NAME env (set by ComfyUI startup or GPU probe)
        const gpuName = process.env.COMFYUI_GPU_NAME ?? process.env.GPU_NAME ?? '';
        if (gpuName) {
            this._detected = detectTierFromGpuName(gpuName);
            console.log(`[GPU_TIER] 🔍 Auto-detected from GPU_NAME="${gpuName}": ${this._detected}`);
            return this._detected;
        }

        // 3. Default: current workstation is RTX 4090 (Ada)
        this._detected = 'ada';
        console.log('[GPU_TIER] ℹ️  No GPU_TIER or GPU_NAME set — defaulting to ada (RTX 4090)');
        return this._detected;
    }

    /** Get full capability profile for current tier */
    getCapabilities(): GpuTierCapabilities {
        return TIER_CAPABILITIES[this.getTier()];
    }

    /** Get capability profile for a specific tier */
    getCapabilitiesForTier(tier: GpuTier): GpuTierCapabilities {
        return TIER_CAPABILITIES[tier];
    }

    /**
     * Get the recommended ComfyUI extra args for the current tier.
     * These flags maximise throughput and minimise VRAM usage.
     */
    getComfyUiArgs(): string[] {
        const cap = this.getCapabilities();
        const args: string[] = ['--gpu-only'];

        switch (cap.recommendedQuantization) {
            case 'nvfp4':
                args.push('--fp8-e4m3fn-unet', '--fp8-e5m2-text-enc'); // best NVFP4 proxy until native support
                break;
            case 'fp8':
                args.push('--fp8-e4m3fn-unet', '--fp8-e5m2-text-enc');
                break;
            case 'none':
            default:
                break;
        }

        return args;
    }

    /**
     * Get the recommended torch.compile / dtype flags for this tier.
     * Used by Genkit inference flows and any custom Python runners.
     */
    getPythonDtypeFlags(): { dtype: string; attnImpl: string; compileMode?: string } {
        const cap = this.getCapabilities();
        if (cap.tier === 'blackwell') {
            return { dtype: 'float8_e4m3fn', attnImpl: 'flash_attention_2', compileMode: 'reduce-overhead' };
        }
        if (cap.tier === 'ada') {
            return { dtype: 'float16', attnImpl: 'sdpa', compileMode: 'reduce-overhead' };
        }
        return { dtype: 'float32', attnImpl: 'eager' };
    }

    /**
     * Returns true if DLSS5 Neural Rendering is available.
     * Agents check this before submitting re-shading post-process jobs.
     */
    isDlss5Available(): boolean {
        return this.getCapabilities().supportsDlss5NeuralRendering;
    }

    /**
     * Returns true if MFG is available for video frame interpolation.
     */
    isMfgAvailable(): boolean {
        return this.getCapabilities().maxMfgMultiplier > 1;
    }

    /** Reset detected tier (useful for testing) */
    reset(): void {
        this._detected = null;
    }

    /** Summary string for logging */
    summary(): string {
        const cap = this.getCapabilities();
        return [
            `tier=${cap.tier}`,
            `dlss=${cap.dlssGeneration}`,
            `mfg_max=${cap.maxMfgMultiplier}x`,
            `quant=${cap.recommendedQuantization}`,
            `vram_saving=${Math.round(cap.vramSavingsFactor * 100)}%`,
            `throughput=${cap.throughputMultiplier}x`,
        ].join(' | ');
    }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

export const gpuTierManager = new GpuTierManager();
