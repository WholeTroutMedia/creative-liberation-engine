/**
 * @module social/relationship-types
 * @description Virtual Strangers — core domain types and Zod schemas
 * Peace-first doctrine: no enemy state. Stranger → Friend arc is the product.
 */
import { z } from 'zod';

// ── Relationship State Machine ─────────────────────────────────────────────

export const RelationshipState = z.enum([
  'stranger',      // Default — no interaction yet
  'acquaintance',  // 1–3 meaningful interactions
  'casual',        // Recurring contact, light shared history
  'collaborator',  // Active work together, high trust
  'close',         // Deep shared history, peak resonance
  'dormant',       // Was close, went quiet — fully recoverable
  'silenced',      // Peace-first: block without declaring enmity
]);
export type RelationshipState = z.infer<typeof RelationshipState>;

// ── Plant Health States (Garden metaphor) ──────────────────────────────────

export const PlantState = z.enum([
  'seed',     // stranger
  'sprout',   // acquaintance
  'bloom',    // collaborator / close
  'dormant',  // dormant relationship
  'wilted',   // very low resonance, not silenced
]);
export type PlantState = z.infer<typeof PlantState>;

// ── Entity ──────────────────────────────────────────────────────────────────

export const EntityType = z.enum(['human', 'agent']);
export type EntityType = z.infer<typeof EntityType>;

export const RelationshipEntitySchema = z.object({
  id: z.string(),
  handle: z.string(),
  type: EntityType,
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type RelationshipEntity = z.infer<typeof RelationshipEntitySchema>;

// ── Events ──────────────────────────────────────────────────────────────────

export const RelationshipEventType = z.enum([
  'first_contact',   // Initial meeting
  'interaction',     // General exchange
  'shared_win',      // Collaboratively accomplished something
  'tension',         // Friction event — non-hostile, recoverable
  'repair',          // Post-tension re-engagement
  'milestone',       // Relationship arc milestone
  'silence',         // Peace-first: initiator chose to silence
]);
export type RelationshipEventType = z.infer<typeof RelationshipEventType>;

export const RelationshipEventSchema = z.object({
  id: z.string(),
  type: RelationshipEventType,
  timestamp: z.string().datetime(),
  initiatorId: z.string(),
  receiverId: z.string(),
  content: z.string(),
  sentiment: z.number().min(-1).max(1).default(0),  // -1 conflict, 0 neutral, 1 harmony
  topics: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type RelationshipEvent = z.infer<typeof RelationshipEventSchema>;

// ── Ledger Entry (human-readable log) ────────────────────────────────────────

export const LedgerEntrySchema = z.object({
  timestamp: z.string().datetime(),
  summary: z.string(),
  stateAtTime: RelationshipState,
  resonanceAtTime: z.number().min(0).max(1),
  eventId: z.string(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

// ── Friendship Log ────────────────────────────────────────────────────────────

export const FriendshipLogSchema = z.object({
  id: z.string(),
  entityA: RelationshipEntitySchema,
  entityB: RelationshipEntitySchema,
  state: RelationshipState,
  resonanceScore: z.number().min(0).max(1).default(0),
  plantHealth: z.number().min(0).max(1).default(0),
  plantState: PlantState,
  events: z.array(RelationshipEventSchema).default([]),
  ledger: z.array(LedgerEntrySchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastInteractionAt: z.string().datetime().optional(),
  interactionCount: z.number().int().min(0).default(0),
  sharedTopics: z.array(z.string()).default([]),
  sentimentHistory: z.array(z.number()).default([]),
});
export type FriendshipLog = z.infer<typeof FriendshipLogSchema>;

// ── Graph View Types (Garden + Constellation) ────────────────────────────────

export interface GardenNode {
  id: string;
  entityId: string;
  handle: string;
  entityType: EntityType;
  state: RelationshipState;
  plantState: PlantState;
  plantHealth: number;         // 0–1 drives animation intensity
  resonanceScore: number;
  lastInteractionAt: string | undefined;
  interactionCount: number;
}

export interface ConstellationNode {
  id: string;
  entityId: string;
  handle: string;
  entityType: EntityType;
  brightness: number;          // 0–1 maps to star brightness
  state: RelationshipState;
}

export interface ConstellationEdge {
  source: string;              // entityId
  target: string;              // entityId
  strength: number;            // resonanceScore
  state: RelationshipState;
}

export interface ConstellationView {
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  subjectEntityId: string;
}

// ── Factory Helpers ───────────────────────────────────────────────────────────

export function makePairId(entityAId: string, entityBId: string): string {
  // Deterministic pair ID regardless of order
  return [entityAId, entityBId].sort().join('::');
}
