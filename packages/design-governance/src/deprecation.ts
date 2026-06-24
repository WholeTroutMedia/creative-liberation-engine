// packages/design-governance/src/deprecation.ts
// DS-704: Deprecation pipeline — flag → migration → removal lifecycle

import type { DeprecationEntry, DeprecationPhase } from './types.js';

// ─── In-Memory Registry ──────────────────────────────────────────────────────

/**
 * Manages the deprecation lifecycle for design tokens.
 *
 * Lifecycle: flagged → migrating → removal-ready → removed
 *
 * The registry is in-memory by default. For persistence, serialize
 * with `toJSON()` and restore with `fromJSON()`.
 */
export class DeprecationPipeline {
    private entries: Map<string, DeprecationEntry> = new Map();

    /**
     * Flag a token for deprecation.
     * If the token is already flagged, this is a no-op.
     */
    flagForDeprecation(
        tokenPath: string,
        reason: string,
        options?: { replacement?: string; removalTarget?: string },
    ): DeprecationEntry {
        if (this.entries.has(tokenPath)) {
            return this.entries.get(tokenPath)!;
        }

        const entry: DeprecationEntry = {
            tokenPath,
            reason,
            replacement: options?.replacement,
            phase: 'flagged',
            flaggedAt: new Date().toISOString(),
            removalTarget: options?.removalTarget,
            remainingUsages: -1, // unknown until scanned
        };

        this.entries.set(tokenPath, entry);
        return entry;
    }

    /**
     * Advance a token to the next deprecation phase.
     * Returns the updated entry, or null if the token isn't in the pipeline.
     */
    advance(tokenPath: string): DeprecationEntry | null {
        const entry = this.entries.get(tokenPath);
        if (!entry) return null;

        const transitions: Record<DeprecationPhase, DeprecationPhase> = {
            'flagged': 'migrating',
            'migrating': 'removal-ready',
            'removal-ready': 'removed',
            'removed': 'removed', // terminal state
        };

        entry.phase = transitions[entry.phase];
        return entry;
    }

    /**
     * Update the remaining usage count for a deprecated token.
     * This should be called after running token analytics.
     */
    updateUsageCount(tokenPath: string, count: number): void {
        const entry = this.entries.get(tokenPath);
        if (entry) {
            entry.remainingUsages = count;
        }
    }

    /**
     * Get all entries in the pipeline, optionally filtered by phase.
     */
    getEntries(phase?: DeprecationPhase): DeprecationEntry[] {
        const all = Array.from(this.entries.values());
        if (phase) return all.filter((e) => e.phase === phase);
        return all;
    }

    /**
     * Get a single entry by token path.
     */
    getEntry(tokenPath: string): DeprecationEntry | undefined {
        return this.entries.get(tokenPath);
    }

    /**
     * Check if a token is deprecated (any phase except removed).
     */
    isDeprecated(tokenPath: string): boolean {
        const entry = this.entries.get(tokenPath);
        return entry !== undefined && entry.phase !== 'removed';
    }

    /**
     * Get entries that are ready for removal (0 remaining usages + removal-ready phase).
     */
    getRemovalCandidates(): DeprecationEntry[] {
        return this.getEntries('removal-ready')
            .filter((e) => e.remainingUsages === 0);
    }

    /**
     * Generate a summary report.
     */
    getReport(): {
        total: number;
        byPhase: Record<DeprecationPhase, number>;
        removalCandidates: number;
    } {
        const byPhase: Record<DeprecationPhase, number> = {
            'flagged': 0,
            'migrating': 0,
            'removal-ready': 0,
            'removed': 0,
        };

        for (const entry of this.entries.values()) {
            byPhase[entry.phase]++;
        }

        return {
            total: this.entries.size,
            byPhase,
            removalCandidates: this.getRemovalCandidates().length,
        };
    }

    // ─── Serialization ────────────────────────────────────────────────────────

    /**
     * Serialize the registry to a plain JSON-compatible object.
     */
    toJSON(): DeprecationEntry[] {
        return Array.from(this.entries.values());
    }

    /**
     * Restore the registry from a serialized array.
     */
    static fromJSON(data: DeprecationEntry[]): DeprecationPipeline {
        const pipeline = new DeprecationPipeline();
        for (const entry of data) {
            pipeline.entries.set(entry.tokenPath, { ...entry });
        }
        return pipeline;
    }
}
