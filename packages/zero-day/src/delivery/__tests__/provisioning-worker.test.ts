import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startProvisioningWorker, getProvisioningStatus } from '../provisioning-worker.js';

// Mock the AgentSpawner so we don't hit real spawning infrastructure
vi.mock('@cle/agent-spawner', () => ({
    AgentSpawner: vi.fn().mockImplementation(() => ({
        spawnFromManifest: vi.fn().mockResolvedValue({ status: 'ready' }),
    })),
}));

// Mock the flow dependency so we don't actually trigger Genkit LLM calls
vi.mock('../../flows/provisioner.js', () => ({
    provisionAgentNetwork: vi.fn().mockImplementation(async (input: any) => ({
        provisioningId: 'prov-mock',
        clientId: input.clientId || 'cli-123',
        status: 'provisioning',
        assignedBlueprint: { id: 'bp-1', name: 'Standard Studio', vertical: 'photography' },
        agentTeam: [
            { agentId: 'VERA', role: 'Context', status: 'initializing' },
            { agentId: 'ATHENA', role: 'Strategy', status: 'initializing' },
            { agentId: 'RELAY', role: 'Operations', status: 'initializing' },
        ],
        dashboardUrl: `https://genesis.test/${input.clientId || 'cli-123'}`,
        estimatedReadyTime: '30s',
        constitutionalFlags: ['data-sovereignty-strict'],
        onboardingSteps: ['Connect Stripe'],
        logs: []
    }))
}));

describe('Zero-Day Provisioning Worker', () => {
    
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('initializes provisioning and tracks status', async () => {
        const input = {
            clientId: 'cli-123',
            clientName: 'Test Studio',
            vertical: 'photography',
            expectedVolume: 'Medium',
            features: ['ecommerce']
        };

        const manifest = await startProvisioningWorker(input as any);

        expect(manifest.clientId).toBe('cli-123');
        expect(manifest.status).toBe('provisioning');
        expect(manifest.agentTeam.length).toBe(3);
        expect(manifest.logs.length).toBeGreaterThanOrEqual(2);

        // Fetch it from tracker
        const tracked = getProvisioningStatus('cli-123');
        expect(tracked).toBeDefined();
        expect(tracked?.provisioningId).toBe('prov-mock');
    });

    it('advances through the background instantiation loop', async () => {
        const input = {
            clientId: 'cli-456',
            clientName: 'Test Studio 2',
            vertical: 'video',
            expectedVolume: 'High',
            features: []
        };

        const manifest = await startProvisioningWorker(input as any);
        
        // With mocked spawnFromManifest resolving immediately, all agents boot after 3s sleep
        await vi.advanceTimersByTimeAsync(7500);
        
        let tracked = getProvisioningStatus('cli-456')!;
        expect(tracked.logs.some(l => l.message.includes('VERA initialized'))).toBe(true);
        expect(tracked.agentTeam.find(a => a.agentId === 'VERA')?.status).toBe('ready');
        expect(tracked.agentTeam.find(a => a.agentId === 'ATHENA')?.status).toBe('ready'); // Boots immediately via mock

        // Advance through the rest of the loop
        await vi.advanceTimersByTimeAsync(25000);

        tracked = getProvisioningStatus('cli-456')!;
        expect(tracked.status).toBe('active');
        expect(tracked.agentTeam.every(a => a.status === 'ready')).toBe(true);
        expect(tracked.logs.some(l => l.message.includes('Provisioning complete'))).toBe(true);
    });
});
