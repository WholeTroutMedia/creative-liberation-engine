import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Phase 7: Cognitive Negotiation (NASA AA-Negotiator)
 * This module solves Decentralized Resource Conflict.
 * When an offline agent wants to edit a file or use a limited resource (like a specific GPU core),
 * it must "drop a Pheromone" (broadcast) on the disk.
 */

// ── Negotiation Schemas ──────────────────────────────────────────────────────

export const PriorityLevel = z.enum(['low', 'normal', 'high', 'critical']);
export type PriorityLevelType = z.infer<typeof PriorityLevel>;

export const PheromoneClaimSchema = z.object({
  agentId: z.string().describe('e.g., Agent-Alpha'),
  resourceId: z.string().describe('e.g., packages/memory/src/VectorStore.ts'),
  priority: PriorityLevel.default('normal'),
  ttlMs: z.number().describe('How soon this agent needs the resource before its task dies'),
  claimTimestampMs: z.number().describe('When the claim was last refreshed'),
  decayLimitMs: z.literal(900000).default(900000), // 15 mins
  previousHash: z.string().optional().describe('SHA256 signature linking to the previous Pheromone State for Byzantine verification'),
});
export type PheromoneClaim = z.infer<typeof PheromoneClaimSchema>;

// ── The Arbiter & Negotiation Manager ────────────────────────────────────────

export class NegotiationManager {
  private negotiationDir: string;

  constructor(workspaceRoot: string) {
    this.negotiationDir = path.join(workspaceRoot, '.agents', 'custody', 'negotiation');
  }

  private async init(): Promise<void> {
    await fs.mkdir(this.negotiationDir, { recursive: true });
  }

  private getResourceFilename(resourceId: string): string {
    // Sanitize resource ID to use as a filename
    const sanitized = resourceId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${sanitized}.pheromone.json`;
  }

  private async isQuarantined(agentId: string): Promise<boolean> {
    const qFile = path.join(this.negotiationDir, 'quarantine.json');
    try {
      const db = JSON.parse(await fs.readFile(qFile, 'utf-8'));
      const expiry = db[agentId];
      if (expiry && Date.now() < expiry) {
        return true;
      }
    } catch {}
    return false;
  }

  private async quarantineAgent(agentId: string): Promise<void> {
    const qFile = path.join(this.negotiationDir, 'quarantine.json');
    await this.init();
    let db: Record<string, number> = {};
    try { db = JSON.parse(await fs.readFile(qFile, 'utf-8')); } catch {}
    
    // 60 minute flush
    db[agentId] = Date.now() + 3600000; 
    await fs.writeFile(qFile, JSON.stringify(db, null, 2), 'utf-8');
  }

  /**
   * Evaluate Pheromone Decay.
   * If a claim is older than 15 minutes without a refresh, it is considered dead.
   */
  isClaimDead(claim: PheromoneClaim): boolean {
    const age = Date.now() - claim.claimTimestampMs;
    return age > claim.decayLimitMs;
  }

  /**
   * The Priority Weights for the Utility-Based Auction
   */
  private getPriorityWeight(p: PriorityLevelType): number {
    switch (p) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
    }
  }

  /**
   * The Conflict Arbiter (AA-Negotiator)
   * Decides which agent wins the resource if a conflict occurs.
   * Returns `true` if the challenger wins, `false` if the defender retains it.
   */
  resolveConflict(challenger: PheromoneClaim, defender: PheromoneClaim): boolean {
    // 1. Pheromone Decay: 
    // If the defender crashed and didn't refresh their claim within 15 min, challenger wins implicitly.
    if (this.isClaimDead(defender)) return true;

    const chalWeight = this.getPriorityWeight(challenger.priority);
    const defWeight = this.getPriorityWeight(defender.priority);

    // 2. Clear Priority Victory (Yielding)
    if (chalWeight > defWeight) return true;
    if (defWeight > chalWeight) return false;

    // 3. Utility-Based Auction (Tie-breaker on equal priorities)
    // The task that expires the soonest wins the resource.
    if (challenger.ttlMs < defender.ttlMs) return true;
    
    // Defender retains if everything else is equal (first-come, first-served)
    return false;
  }

  /**
   * Target A: Broadcast the Claim 
   * The Agent requests usage of a resource. The Arbiter evaluates against existing broadcasts.
   */
  async requestResource(request: Omit<PheromoneClaim, 'claimTimestampMs' | 'decayLimitMs'>): Promise<{ success: boolean; reason: string }> {
    await this.init();

    // Self-Immunity Check
    if (await this.isQuarantined(request.agentId)) {
      return { success: false, reason: 'BYZANTINE FAILURE: Agent is Quarantined for 60 minutes due to corrupted hashes.' };
    }
    
    const challenger: PheromoneClaim = {
      ...request,
      claimTimestampMs: Date.now(),
      decayLimitMs: 900000 // 15 mins
    };

    const filename = this.getResourceFilename(request.resourceId);
    const dest = path.join(this.negotiationDir, filename);

    // Check if another agent has a claim on this resource
    let defender: PheromoneClaim | null = null;
    let currentHash = 'genesis';

    try {
      const raw = await fs.readFile(dest, 'utf-8');
      // Simulated simple hash generation from the defender state
      currentHash = Buffer.from(raw).toString('base64').substring(0, 16); 
      defender = PheromoneClaimSchema.parse(JSON.parse(raw));
    } catch (e: any) {
      // File doesn't exist or is corrupt, resource is free
    }

    // Hash-Chain Verification (The Check-The-Checker Protocol)
    if (defender && request.previousHash) {
       if (request.previousHash !== currentHash) {
          // Hallucinated or corrupted hash detected
          await this.quarantineAgent(request.agentId);
          return { success: false, reason: 'BYZANTINE FAULT: Hash-Chain broken. Agent Quarantined.' };
       }
    }

    if (defender) {
      const challengerWins = this.resolveConflict(challenger, defender);
      if (!challengerWins) {
        return { success: false, reason: `Resource claimed by ${defender.agentId} (Priority: ${defender.priority}). Will expire soon.` };
      }
    }

    // Write the new or overwritten Pheromone
    await fs.writeFile(dest, JSON.stringify(challenger, null, 2), 'utf-8');
    return { success: true, reason: 'Custody granted via Arbiter.' };
  }

  /**
   * Target C: The "Pheromone" Decay Refresh.
   * An agent must call this every 5-10 minutes while holding a task 
   * to prove it didn't crash in the offline bunker.
   */
  async refreshClaim(resourceId: string, agentId: string): Promise<boolean> {
    const filename = this.getResourceFilename(resourceId);
    const dest = path.join(this.negotiationDir, filename);

    try {
      const raw = await fs.readFile(dest, 'utf-8');
      const claim = PheromoneClaimSchema.parse(JSON.parse(raw));

      if (claim.agentId === agentId) {
        claim.claimTimestampMs = Date.now();
        await fs.writeFile(dest, JSON.stringify(claim, null, 2), 'utf-8');
        return true;
      }
    } catch { }

    return false; // Claim lost or doesn't exist
  }

  /** Release a claim once the agent is done */
  async releaseResource(resourceId: string, agentId: string): Promise<void> {
    const filename = this.getResourceFilename(resourceId);
    const dest = path.join(this.negotiationDir, filename);

    try {
      const raw = await fs.readFile(dest, 'utf-8');
      const claim = PheromoneClaimSchema.parse(JSON.parse(raw));

      if (claim.agentId === agentId) {
        await fs.unlink(dest);
      }
    } catch { }
  }
}
