import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryTierManager } from '../tier-manager.js';

// Mock MemoryBus
vi.mock('../bus.js', () => ({
    memoryBus: {
        commit: vi.fn().mockImplementation(async (write) => ({
            id: 'mock-id',
            timestamp: new Date().toISOString(),
            ...write,
        })),
        recall: vi.fn().mockResolvedValue([]),
    }
}));

import { memoryBus } from '../bus.js';

describe('MemoryTierManager', () => {
    let tierManager: MemoryTierManager;

    beforeEach(() => {
        vi.clearAllMocks();
        tierManager = new MemoryTierManager();
    });

    it('writes to working tier automatically and caches locally', async () => {
        const result = await tierManager.write({
            agentName: 'TEST_AGENT',
            sessionId: 'sesh-123',
            task: 'User preference query',
            outcome: 'User prefers dark mode',
            tags: [],
            success: true
        });

        expect(result.id).toBe('mock-id');
        expect(memoryBus.commit).toHaveBeenCalledWith(expect.objectContaining({
            agentName: 'TEST_AGENT',
            task: 'User preference query',
            outcome: 'User prefers dark mode',
            metadata: expect.objectContaining({ tier: 'working' }) // Check promotion defaults to working
        }));
    });

    it('recalls from working tier utilizing fast cache without hitting bus if exact match', async () => {
        await tierManager.write({
            agentName: 'TEST_AGENT',
            sessionId: 'sesh-123',
            task: 'User preference query',
            outcome: 'User prefers dark mode',
            tags: [],
            success: true
        });

        // Fast keyword recall from working tier cache
        const memories = await tierManager.recall({
            tier: 'working',
            query: 'dark mode'
        });

        expect(memories.length).toBe(1);
        expect(memories[0].outcome).toBe('User prefers dark mode');
        expect(memoryBus.recall).not.toHaveBeenCalled(); // Cache hit
    });

    it('promotes an entry to mid-term', async () => {
        const mockEntry: any = {
            id: 'mem-1',
            agentName: 'STRATA',
            task: 'Decide project architecture',
            outcome: 'Project architecture decided',
            timestamp: new Date().toISOString(),
            success: true,
            tags: [],
            sessionId: 'test',
            tier: 'working'
        };

        const result = await tierManager.promote(mockEntry, { toTier: 'mid-term', signalScore: 0.85 });
        expect(result.tier).toBe('mid-term');
        expect(result.signalScore).toBe(0.85);

        expect(memoryBus.commit).toHaveBeenCalledWith(expect.objectContaining({
            metadata: expect.objectContaining({
                tier: 'mid-term',
                signalScore: 0.85,
                consolidatedAt: expect.any(String),
                promotedFromId: 'mem-1'
            })
        }));
    });

    it('drains working cache of old entries', async () => {
        await tierManager.write({
            agentName: 'TEST_AGENT',
            task: 'Test task',
            outcome: 'Old memory',
            sessionId: 'test',
            tags: [],
            success: true
        });

        // Drain everything older than -1 seconds (so it drains it)
        const drained = tierManager.drainWorking(-1000);
        expect(drained.length).toBe(1);

        const freshSearch = await tierManager.recall({ tier: 'working', query: 'old' });
        expect(freshSearch.length).toBe(0); // Gone from working cache
    });
});
