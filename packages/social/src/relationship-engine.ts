/**
 * @module social/relationship-engine
 * @description Virtual Strangers — stateless relationship state machine
 * Handles arc progression, resonance scoring, plant health, and peace-first doctrine.
 */

import type {
  FriendshipLog,
  RelationshipEvent,
  RelationshipEntity,
  RelationshipState,
  PlantState,
  LedgerEntry,
} from './relationship-types.js';
import { FriendshipLogSchema, makePairId } from './relationship-types.js';

// ── State Transition Thresholds ────────────────────────────────────────────

const STATE_THRESHOLDS: Record<RelationshipState, { minInteractions: number; minResonance: number }> = {
  stranger:      { minInteractions: 0,  minResonance: 0    },
  acquaintance:  { minInteractions: 1,  minResonance: 0.05 },
  casual:        { minInteractions: 4,  minResonance: 0.25 },
  collaborator:  { minInteractions: 10, minResonance: 0.50 },
  close:         { minInteractions: 20, minResonance: 0.75 },
  dormant:       { minInteractions: 0,  minResonance: 0    }, // entered via decay, not count
  silenced:      { minInteractions: 0,  minResonance: 0    }, // entered via explicit action
};

// ── Plant Health Mapping ───────────────────────────────────────────────────

function derivePhantState(health: number, state: RelationshipState): PlantState {
  if (state === 'dormant') return 'dormant';
  if (state === 'silenced') return 'wilted';
  if (health >= 0.75) return 'bloom';
  if (health >= 0.45) return 'bloom';
  if (health >= 0.20) return 'sprout';
  if (health >= 0.05) return 'sprout';
  return 'seed';
}

// ── Resonance Calculation ─────────────────────────────────────────────────

export function calculateResonance(log: FriendshipLog): number {
  if (log.events.length === 0) return 0;

  const now = Date.now();
  const lastMs = log.lastInteractionAt
    ? now - new Date(log.lastInteractionAt).getTime()
    : now - new Date(log.createdAt).getTime();

  // Frequency decay: interactions cool off over time
  const daysSinceLast = lastMs / 86_400_000;
  const frequencyScore = Math.max(0, 1 - daysSinceLast / 60); // full decay at 60 days

  // Sentiment average from recent events (last 20)
  const recent = log.events.slice(-20);
  const avgSentiment = recent.reduce((acc, e) => acc + e.sentiment, 0) / recent.length;
  const sentimentScore = (avgSentiment + 1) / 2; // normalize -1..1 to 0..1

  // Repair bonus: repairs are high-value events
  const repairCount = log.events.filter(e => e.type === 'repair').length;
  const repairBonus = Math.min(0.15, repairCount * 0.05);

  // Shared win multiplier
  const winCount = log.events.filter(e => e.type === 'shared_win').length;
  const winBonus = Math.min(0.10, winCount * 0.03);

  // Interaction volume (diminishing returns)
  const volumeScore = Math.min(1, Math.log10(log.interactionCount + 1) / 2);

  const raw = (frequencyScore * 0.35)
    + (sentimentScore * 0.30)
    + (volumeScore * 0.20)
    + repairBonus
    + winBonus;

  return Math.min(1, Math.max(0, raw));
}

// ── Plant Health ──────────────────────────────────────────────────────────

export function calculatePlantHealth(log: FriendshipLog): number {
  if (log.state === 'silenced') return 0;
  if (log.state === 'dormant') {
    // Dormant can recover — show partial health
    return Math.min(0.30, log.resonanceScore * 0.5);
  }
  return log.resonanceScore;
}

// ── State Advance ─────────────────────────────────────────────────────────

export function advanceState(log: FriendshipLog): RelationshipState {
  // Peace doctrine: silenced is irrevocable unless repaired explicitly
  if (log.state === 'silenced') return 'silenced';

  const states: RelationshipState[] = ['stranger', 'acquaintance', 'casual', 'collaborator', 'close'];
  let best: RelationshipState = 'stranger';

  for (const s of states) {
    const t = STATE_THRESHOLDS[s];
    if (log.interactionCount >= t.minInteractions && log.resonanceScore >= t.minResonance) {
      best = s;
    }
  }

  // Dormancy check: if previously close/collaborator but resonance has collapsed
  const wasDeep = ['collaborator', 'close'].includes(log.state);
  if (wasDeep && log.resonanceScore < 0.10) {
    return 'dormant';
  }

  return best;
}

// ── Factory: Create Log ───────────────────────────────────────────────────

export function createFriendshipLog(
  entityA: RelationshipEntity,
  entityB: RelationshipEntity,
): FriendshipLog {
  const now = new Date().toISOString();
  return FriendshipLogSchema.parse({
    id: makePairId(entityA.id, entityB.id),
    entityA,
    entityB,
    state: 'stranger',
    resonanceScore: 0,
    plantHealth: 0,
    plantState: 'seed',
    events: [],
    ledger: [],
    createdAt: now,
    updatedAt: now,
    interactionCount: 0,
    sharedTopics: [],
    sentimentHistory: [],
  });
}

// ── Record Event ──────────────────────────────────────────────────────────

export function recordEvent(
  log: FriendshipLog,
  event: Omit<RelationshipEvent, 'id' | 'timestamp'>,
): FriendshipLog {
  // Peace doctrine: silenced logs accept no new events from the silenced entity
  if (log.state === 'silenced') return log;

  const fullEvent: RelationshipEvent = {
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };

  const updatedEvents = [...log.events, fullEvent];
  const updatedTopics = mergeTopics(log.sharedTopics, event.topics ?? []);
  const updatedSentimentHistory = [...log.sentimentHistory, event.sentiment ?? 0].slice(-50);
  const interactionCount = event.type !== 'silence' ? log.interactionCount + 1 : log.interactionCount;

  // Build partial log for resonance calculation
  const partial: FriendshipLog = {
    ...log,
    events: updatedEvents,
    interactionCount,
    sharedTopics: updatedTopics,
    sentimentHistory: updatedSentimentHistory,
    lastInteractionAt: fullEvent.timestamp,
  };

  const resonanceScore = calculateResonance(partial);
  // Peace doctrine: silence event immediately forces silenced state
  const newState: RelationshipState = event.type === 'silence'
    ? 'silenced'
    : advanceState({ ...partial, resonanceScore });
  const plantHealth = calculatePlantHealth({ ...partial, resonanceScore, state: newState });
  const plantState = derivePhantState(plantHealth, newState);

  const ledgerEntry: LedgerEntry = {
    timestamp: fullEvent.timestamp,
    summary: summarizeEvent(fullEvent, newState),
    stateAtTime: newState,
    resonanceAtTime: resonanceScore,
    eventId: fullEvent.id,
  };

  return {
    ...partial,
    state: newState,
    resonanceScore,
    plantHealth,
    plantState,
    ledger: [...log.ledger, ledgerEntry],
    updatedAt: fullEvent.timestamp,
  };
}


// ── Silence Entity (Peace Doctrine) ──────────────────────────────────────

export function silenceEntity(
  log: FriendshipLog,
  initiatorId: string,
): FriendshipLog {
  return recordEvent(log, {
    type: 'silence',
    initiatorId,
    receiverId: log.entityA.id === initiatorId ? log.entityB.id : log.entityA.id,
    content: 'Connection silenced.',
    sentiment: 0,
    topics: [],
    metadata: { peaceFirst: true },
  });
}

// ── Repair Relationship ───────────────────────────────────────────────────

export function repairRelationship(
  log: FriendshipLog,
  initiatorId: string,
  content: string,
): FriendshipLog {
  if (log.state === 'silenced') return log; // Peace doctrine: silence is respected

  return recordEvent(log, {
    type: 'repair',
    initiatorId,
    receiverId: log.entityA.id === initiatorId ? log.entityB.id : log.entityA.id,
    content,
    sentiment: 0.6, // Repair starts positive
    topics: ['reconnection'],
    metadata: { isRepair: true },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────

function mergeTopics(existing: string[], incoming: string[]): string[] {
  const merged = new Set([...existing, ...incoming]);
  return Array.from(merged).slice(0, 50); // cap at 50 topics
}

function summarizeEvent(event: RelationshipEvent, newState: RelationshipState): string {
  const typeLabels: Record<string, string> = {
    first_contact: 'First meeting',
    interaction: 'Interaction',
    shared_win: 'Shared win',
    tension: 'Moment of friction',
    repair: 'Reconnection',
    milestone: 'Milestone reached',
    silence: 'Connection silenced',
  };
  const topics = event.topics.length > 0 ? ` (${event.topics.slice(0, 3).join(', ')})` : '';
  return `${typeLabels[event.type] ?? event.type}${topics} — now ${newState}`;
}
