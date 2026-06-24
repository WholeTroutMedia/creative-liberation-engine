import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DreamScheduler, DreamConfig, DreamCycleResult } from '../src/dream';
import type { Task, Agent } from '../src/types';
import { dispatchEmitter } from '../src/events';

describe('DREAM Cycle Validation (WS-03)', () => {
    let scheduler: DreamScheduler;
    let queuedTasks: Task[];
    let idleAgents: Agent[];
    let claimedTasks: Map<string, string>; // taskId -> agentId

    beforeEach(() => {
        queuedTasks = [];
        idleAgents = [];
        claimedTasks = new Map();
        
        // Mock the hooks for the scheduler
        scheduler = new DreamScheduler(
            {
                pollIntervalMs: 1000,
                maxDispatchPerCycle: 5,
                minIdleBeforePickupMs: 0, // Instant pickup for tests
                maxSpawnDepth: 3,
            },
            {
                getQueuedTasks: async () => queuedTasks,
                getIdleAgents: async () => idleAgents,
                getTaskById: async (id: string) => [...queuedTasks, {
                    id: 'task-unmet',
                    title: 'Blocker',
                    workstream: 'core',
                    priority: 'P1',
                    status: 'active',
                    created: new Date().toISOString(),
                    spawn_depth: 0,
                    dependencies: []
                } as Task].find(t => t.id === id),
                claimTask: async (taskId: string, agentId: string) => {
                    claimedTasks.set(taskId, agentId);
                    // Remove from queued tasks to simulate claim
                    queuedTasks = queuedTasks.filter(t => t.id !== taskId);
                }
            }
        );
    });

    afterEach(() => {
        scheduler.stop();
        vi.restoreAllMocks();
    });

    it('should pickup idle agent, claim task, and complete the cycle', async () => {
        // 1. Setup an idle agent
        const agent: Agent = {
            agent_id: 'agent-123',
            capabilities: ['code'],
            workstream: 'core',
            last_seen: new Date(Date.now() - 60000).toISOString(), // Idle for 1 min
            notifications: [],
        };
        idleAgents.push(agent);

        // 2. Setup a queued task
        const task: Task = {
            id: 'task-abc',
            title: 'Implement feature X',
            workstream: 'core',
            priority: 'P1',
            status: 'queued',
            created: new Date().toISOString(),
            assigned_to_capability: 'code',
            spawn_depth: 0,
            dependencies: [],
        };
        queuedTasks.push(task);

        // 3. Trigger a DREAM cycle manually
        const result = await scheduler.triggerCycle();

        // 4. Validate cycle output
        expect(result.dispatched.length).toBe(1);
        expect(result.dispatched[0].agentId).toBe('agent-123');
        expect(result.dispatched[0].taskId).toBe('task-abc');

        // 5. Validate the claim logic worked
        expect(claimedTasks.get('task-abc')).toBe('agent-123');
        
        // Ensure queue is empty after dispatch
        expect(queuedTasks.length).toBe(0);
    });

    it('should skip tasks when dependencies are unmet', async () => {
        const agent: Agent = {
            agent_id: 'agent-456',
            capabilities: ['test'],
            workstream: 'qa',
            last_seen: new Date(Date.now() - 60000).toISOString(),
            notifications: [],
        };
        idleAgents.push(agent);

        const task: Task = {
            id: 'task-def',
            title: 'Test feature X',
            workstream: 'qa',
            priority: 'P1',
            status: 'queued',
            created: new Date().toISOString(),
            assigned_to_capability: 'test',
            spawn_depth: 0,
            dependencies: ['task-unmet'], // Unmet dependency
        };
        queuedTasks.push(task);

        // task-unmet is provided via getTaskById in the setup mock

        const result = await scheduler.triggerCycle();

        expect(result.dispatched.length).toBe(0);
        expect(result.skipped.length).toBe(1);
        expect(result.skipped[0].reason).toBe('dependencies_unmet');
    });
});
