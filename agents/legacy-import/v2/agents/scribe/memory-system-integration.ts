/**
 * VERA Memory System Integration
 * Connects VERA (SCRIBE operator) to Hippocampus analog
 * Implements rapid encoding and boundary detection
 */

import { Hippocampus } from '../../backend/src/core/memory-system/hippocampus';
import { MemoryContext, BoundaryType } from '../../backend/src/core/memory-system/types';

export class VERAMemorySystem {
  private hippocampus: Hippocampus;
  private currentSessionId: string | null = null;

  constructor(hippocampus: Hippocampus) {
    this.hippocampus = hippocampus;
  }

  /**
   * Record session event (VERA's primary memory function)
   */
  public recordEvent(event: {
    type: string;
    description: string;
    agent_id?: string;
    data?: any;
    importance?: number;
    tags?: string[];
  }): void {
    const context: MemoryContext = {
      agent_id: event.agent_id,
      session_id: this.currentSessionId || 'unknown',
      tags: event.tags || [event.type],
      boundary_type: this.inferBoundaryType(event)
    };

    const memory = this.hippocampus.encode(
      {
        ...event.data,
        event_type: event.type,
        description: event.description
      },
      context
    );

    console.log(`[VERA] Encoded memory: ${memory.id} (${event.type})`);
  }

  /**
   * Start new session
   */
  public startSession(sessionId: string): void {
    this.currentSessionId = sessionId;
    console.log(`[VERA] Started session: ${sessionId}`);

    this.recordEvent({
      type: 'session_start',
      description: `Session ${sessionId} started`,
      tags: ['session', 'boundary']
    });
  }

  /**
   * End session (triggers HARD boundary)
   */
  public endSession(): void {
    if (!this.currentSessionId) return;

    this.recordEvent({
      type: 'session_end',
      description: `Session ${this.currentSessionId} ended`,
      tags: ['session', 'boundary', 'hard_boundary']
    });

    console.log(`[VERA] Ended session: ${this.currentSessionId}`);
    this.currentSessionId = null;
  }

  /**
   * Record decision (high importance)
   */
  public recordDecision(decision: {
    agent_id: string;
    decision_type: string;
    description: string;
    outcome: any;
    constitutional_reviewed?: boolean;
  }): void {
    this.recordEvent({
      type: 'decision',
      description: decision.description,
      agent_id: decision.agent_id,
      data: {
        decision_type: decision.decision_type,
        outcome: decision.outcome,
        constitutional_reviewed: decision.constitutional_reviewed
      },
      importance: decision.constitutional_reviewed ? 0.9 : 0.7,
      tags: ['decision', decision.decision_type]
    });
  }

  /**
   * Record agent action
   */
  public recordAction(action: {
    agent_id: string;
    action_type: string;
    description: string;
    result?: any;
  }): void {
    this.recordEvent({
      type: 'action',
      description: action.description,
      agent_id: action.agent_id,
      data: {
        action_type: action.action_type,
        result: action.result
      },
      tags: ['action', action.action_type]
    });
  }

  /**
   * Record pattern discovery (for KEEPER)
   */
  public recordPattern(pattern: {
    source_agent: string;
    pattern_type: string;
    description: string;
    confidence: number;
  }): void {
    this.recordEvent({
      type: 'pattern',
      description: pattern.description,
      agent_id: pattern.source_agent,
      data: {
        pattern_type: pattern.pattern_type,
        confidence: pattern.confidence
      },
      importance: Math.min(0.9, pattern.confidence + 0.2),
      tags: ['pattern', pattern.pattern_type]
    });
  }

  /**
   * Get session memory count
   */
  public getSessionMemoryCount(): number {
    return this.hippocampus.getMemoryCount();
  }

  /**
   * Get recent boundaries
   */
  public getRecentBoundaries(limit: number = 5) {
    return this.hippocampus.getRecentBoundaries(limit);
  }

  /**
   * Infer boundary type from event
   */
  private inferBoundaryType(event: any): BoundaryType | undefined {
    if (event.type === 'session_end' || event.tags?.includes('hard_boundary')) {
      return BoundaryType.HARD;
    }
    if (event.tags?.includes('soft_boundary')) {
      return BoundaryType.SOFT;
    }
    return undefined;
  }
}
