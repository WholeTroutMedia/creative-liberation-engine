/**
 * ECHO Memory System Integration
 * Artist intelligence with pattern separation
 * Prevents conflation of similar but distinct artist trajectories
 */

import { PatternSeparator, SeparationDecision } from '../../backend/src/core/memory-system/pattern-separator';
import { Pattern, PatternStability } from '../../backend/src/core/memory-system/types';

export interface ArtistPattern extends Pattern {
  artist_id?: string;
  trajectory_type: 'rapid_growth' | 'steady_climb' | 'breakthrough' | 'plateau_breakthrough';
  break_even_days?: number;
  success_factors: string[];
}

export class ECHOMemorySystem {
  private patternSeparator: PatternSeparator;
  private artistPatterns: Map<string, ArtistPattern> = new Map();

  constructor() {
    this.patternSeparator = new PatternSeparator();
  }

  /**
   * Learn from artist (with pattern separation)
   */
  public learnFromArtist(artistData: {
    artist_id: string;
    trajectory_type: ArtistPattern['trajectory_type'];
    break_even_days?: number;
    success_factors: string[];
    summary: string;
    detailed_metrics: any;
  }): SeparationDecision {
    // Create pattern from artist data
    const newPattern: ArtistPattern = {
      id: `artist_pattern_${artistData.artist_id}_${Date.now()}`,
      type: 'artist',
      summary: artistData.summary,
      detailed_content: {
        metrics: artistData.detailed_metrics,
        learned_at: new Date()
      },
      stability: PatternStability.TRANSIENT,
      evidence: {
        source_memories: [],
        successful_retrievals: 0,
        failed_retrievals: 0,
        confidence: 0.6,
        first_observed: new Date(),
        last_validated: new Date()
      },
      constitutional_cleared: false,
      artist_id: artistData.artist_id,
      trajectory_type: artistData.trajectory_type,
      break_even_days: artistData.break_even_days,
      success_factors: artistData.success_factors
    };

    // Use pattern separator to prevent conflation
    const existingPatterns = Array.from(this.artistPatterns.values());
    const decision = this.patternSeparator.separate(newPattern, existingPatterns);

    console.log(`[ECHO] Pattern separation decision: ${decision.action} (${decision.reason})`);

    // Handle separation decision
    switch (decision.action) {
      case 'merge':
        if (decision.related_pattern_ids?.[0]) {
          const existing = this.artistPatterns.get(decision.related_pattern_ids[0]);
          if (existing) {
            const merged = this.patternSeparator.merge(existing, newPattern);
            this.artistPatterns.set(existing.id, merged as ArtistPattern);
            console.log(`[ECHO] Merged into pattern: ${existing.id}`);
          }
        }
        break;

      case 'separate':
        const separated = this.patternSeparator.createSeparated(
          newPattern,
          decision.related_pattern_ids || [],
          decision.differentiation_features || []
        ) as ArtistPattern;
        this.artistPatterns.set(separated.id, separated);
        console.log(`[ECHO] Created separated pattern: ${separated.id}`);
        break;

      case 'create_new':
        this.artistPatterns.set(newPattern.id, newPattern);
        console.log(`[ECHO] Created new pattern: ${newPattern.id}`);
        break;
    }

    return decision;
  }

  /**
   * Find similar artist trajectories (compound learning)
   */
  public findSimilarTrajectories(artistId: string): ArtistPattern[] {
    const artist = this.getArtistPattern(artistId);
    if (!artist) return [];

    return Array.from(this.artistPatterns.values())
      .filter(p => p.trajectory_type === artist.trajectory_type && p.artist_id !== artistId)
      .sort((a, b) => b.evidence.confidence - a.evidence.confidence)
      .slice(0, 5);
  }

  /**
   * Generate coaching insights (compound learning application)
   */
  public generateCoachingInsights(artistId: string): {
    insights: string[];
    related_patterns: ArtistPattern[];
    confidence: number;
  } {
    const similarTrajectories = this.findSimilarTrajectories(artistId);
    
    if (similarTrajectories.length === 0) {
      return {
        insights: ['This is a novel trajectory - learning in progress'],
        related_patterns: [],
        confidence: 0.3
      };
    }

    // Extract common success factors
    const successFactorCounts = new Map<string, number>();
    for (const pattern of similarTrajectories) {
      for (const factor of pattern.success_factors) {
        successFactorCounts.set(factor, (successFactorCounts.get(factor) || 0) + 1);
      }
    }

    // Generate insights from most common factors
    const insights = Array.from(successFactorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([factor, count]) => 
        `${factor} (seen in ${count}/${similarTrajectories.length} similar trajectories)`
      );

    // Calculate confidence based on pattern stability
    const avgConfidence = similarTrajectories.reduce(
      (sum, p) => sum + p.evidence.confidence,
      0
    ) / similarTrajectories.length;

    return {
      insights,
      related_patterns: similarTrajectories,
      confidence: avgConfidence
    };
  }

  /**
   * Get artist pattern
   */
  private getArtistPattern(artistId: string): ArtistPattern | undefined {
    return Array.from(this.artistPatterns.values())
      .find(p => p.artist_id === artistId);
  }

  /**
   * Validate separation quality (for auditing)
   */
  public validatePatternSeparation(): {
    well_separated: boolean;
    issues: string[];
  } {
    const patterns = Array.from(this.artistPatterns.values());
    return this.patternSeparator.validateSeparation(patterns);
  }

  /**
   * Get pattern statistics
   */
  public getStatistics() {
    const patterns = Array.from(this.artistPatterns.values());
    
    return {
      total_patterns: patterns.length,
      by_stability: {
        transient: patterns.filter(p => p.stability === PatternStability.TRANSIENT).length,
        consolidating: patterns.filter(p => p.stability === PatternStability.CONSOLIDATING).length,
        stable: patterns.filter(p => p.stability === PatternStability.STABLE).length
      },
      by_trajectory: {
        rapid_growth: patterns.filter(p => p.trajectory_type === 'rapid_growth').length,
        steady_climb: patterns.filter(p => p.trajectory_type === 'steady_climb').length,
        breakthrough: patterns.filter(p => p.trajectory_type === 'breakthrough').length,
        plateau_breakthrough: patterns.filter(p => p.trajectory_type === 'plateau_breakthrough').length
      },
      avg_confidence: patterns.reduce((sum, p) => sum + p.evidence.confidence, 0) / patterns.length
    };
  }
}
