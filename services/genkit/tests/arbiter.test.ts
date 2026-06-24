import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { NegotiationManager, PheromoneClaim } from '../src/negotiation/arbiter';

describe('Cognitive Negotiation (Handshake Protocol)', () => {
  const testWorkspace = path.join(__dirname, '.test_workspace_negotiation');
  let manager: NegotiationManager;

  beforeEach(async () => {
    manager = new NegotiationManager(testWorkspace);
    await fs.rm(testWorkspace, { recursive: true, force: true }).catch(() => {});
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true }).catch(() => {});
  });

  it('should grant custody to the first agent requesting an idle resource', async () => {
    const res = await manager.requestResource({
      agentId: 'Agent-Alpha',
      resourceId: 'test-file.ts',
      priority: 'normal',
      ttlMs: 3600000 // 1 hour
    });

    expect(res.success).toBe(true);
  });

  it('should deny custody if a defender holds equal priority and equal/shorter TTL', async () => {
    // 1st Agent claims it
    await manager.requestResource({
      agentId: 'Agent-Beta',
      resourceId: 'database.config',
      priority: 'high',
      ttlMs: 1800000 // 30 min expiration
    });

    // 2nd Agent tries to claim it
    const res = await manager.requestResource({
      agentId: 'Agent-Delta',
      resourceId: 'database.config',
      priority: 'high',
      ttlMs: 3600000 // 1 hour expiration
    });

    // Beta retains it because it expires sooner (Utility-Based Auction)
    expect(res.success).toBe(false);
    expect(res.reason).toContain('Agent-Beta');
  });

  it('should allow a Challenger to evict a Defender via Utility-Based Auction (shorter TTL)', async () => {
    await manager.requestResource({
      agentId: 'Agent-Alpha',
      resourceId: 'gpu-core-0',
      priority: 'critical',
      ttlMs: 7200000 // 2 hours
    });

    const res = await manager.requestResource({
      agentId: 'Agent-Omega',
      resourceId: 'gpu-core-0',
      priority: 'critical',
      ttlMs: 600000 // 10 minutes (dies sooner, needs it immediate)
    });

    // Omega evicts Alpha because its task dies sooner
    expect(res.success).toBe(true);
  });

  it('should allow a Challenger to evict a Defender via Priority Weight', async () => {
    await manager.requestResource({
      agentId: 'Agent-Alpha',
      resourceId: 'VectorStore.ts',
      priority: 'normal',
      ttlMs: 1000 
    });

    const res = await manager.requestResource({
      agentId: 'Agent-Zeta',
      resourceId: 'VectorStore.ts',
      priority: 'critical',
      ttlMs: 9999999 
    });

    // Zeta wins strictly on weight (Critical > Normal) 
    expect(res.success).toBe(true);
  });

  it('should allow an agent to refresh its Pheromone Claim', async () => {
    await manager.requestResource({
      agentId: 'Agent-Sigma',
      resourceId: 'refresh-test',
      priority: 'low',
      ttlMs: 10000
    });

    const refreshed = await manager.refreshClaim('refresh-test', 'Agent-Sigma');
    expect(refreshed).toBe(true);

    const badRefresh = await manager.refreshClaim('refresh-test', 'Agent-Other');
    expect(badRefresh).toBe(false);
  });
});
