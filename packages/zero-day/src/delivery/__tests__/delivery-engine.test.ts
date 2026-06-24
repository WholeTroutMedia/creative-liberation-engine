import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('../../intelligence/vision-curator.js', () => ({
    visionCuratorFlow: vi.fn().mockResolvedValue({
        aesthetic_score: 80, emotion_score: 70, brand_alignment: 75,
        tags: ['test'], curation_decision: 'gallery', reasoning: 'mock',
    }),
}));

import { DeliveryEngine } from '../delivery-engine.js';

describe('Zero-Day Delivery Engine', () => {
    let engine: DeliveryEngine;

    beforeEach(() => {
        engine = new DeliveryEngine();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('creates a new project with deliverables', async () => {
        const project = await engine.createProject({
            title: 'Q3 Marketing Assets',
            client_id: 'cli-123',
            client_name: 'Acme Corp',
            project_type: 'retainer',
            contract_value: 15000,
            start_date: '2026-03-01T00:00:00Z',
            deadline: '2026-03-31T00:00:00Z',
            deliverables: [
                { title: 'Social Media Kit', priority: 'high' },
                { title: 'Blog Headers', priority: 'medium' }
            ]
        });

        expect(project.id).toMatch(/^proj-\d+$/);
        expect(project.title).toBe('Q3 Marketing Assets');
        expect(project.status).toBe('intake');
        expect(project.health).toBe('on_track');
        expect(project.deliverables.length).toBe(2);
        expect(project.deliverables[0].title).toBe('Social Media Kit');
        expect(project.deliverables[0].priority).toBe('high');
        expect(project.deliverables[0].status).toBe('not_started');
    });

    it('updates deliverable status and auto-computes health', async () => {
        const project = await engine.createProject({
            title: 'Test Proj',
            client_id: 'cli-456',
            client_name: 'Test Client',
            project_type: 'one-off',
            contract_value: 5000,
            start_date: '2026-03-01T00:00:00Z',
            deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
            deliverables: [
                { title: 'Logo Design' }
            ]
        });

        const delivId = project.deliverables[0].id;
        
        let updatedDeliv = await engine.updateDeliverableStatus(project.id, delivId, 'in_progress');
        expect(updatedDeliv.status).toBe('in_progress');
        
        updatedDeliv = await engine.updateDeliverableStatus(project.id, delivId, 'sent_to_client');
        expect(updatedDeliv.status).toBe('sent_to_client');
        expect(updatedDeliv.delivered_at).toBeDefined();

        // Test the self-healing timeout (5 days awaiting client)
        const currentProject = engine.getProject(project.id)!;
        expect(currentProject.health).toBe('on_track');

        vi.advanceTimersByTime(5 * 24 * 60 * 60 * 1000 + 1000); // 5 days + 1 sec
        
        expect(currentProject.health).toBe('at_risk');
        expect(currentProject.health_reason).toContain('awaiting client review for 5+ days');
    });

    it('tracks revisions and triggers blocked health state if cap is reached', async () => {
        const project = await engine.createProject({
            title: 'Test Proj',
            client_id: 'cli-456',
            client_name: 'Test Client',
            project_type: 'one-off',
            contract_value: 5000,
            start_date: '2026-03-01T00:00:00Z',
            deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            deliverables: [
                { title: 'Logo Design' } // default max_revisions is 2
            ]
        });

        const delivId = project.deliverables[0].id;

        await engine.updateDeliverableStatus(project.id, delivId, 'revision_requested', 'Make it pop');
        await engine.updateDeliverableStatus(project.id, delivId, 'revision_requested', 'Too much pop');

        const currentProject = engine.getProject(project.id)!;
        expect(currentProject.deliverables[0].revision_count).toBe(2);
        expect(currentProject.health).toBe('blocked');
    });

    it('records payments and updates dashboard summary', async () => {
        const project = await engine.createProject({
            title: 'Test Proj',
            client_id: 'cli-000',
            client_name: 'Client',
            project_type: 'test',
            contract_value: 10000,
            start_date: '2026-03-01T00:00:00Z',
            deadline: '2026-03-31T00:00:00Z',
        });

        engine.updateProjectStatus(project.id, 'active');
        engine.recordPayment(project.id, 5000);

        const currentProject = engine.getProject(project.id)!;
        expect(currentProject.amount_received).toBe(5000);

        const summary = engine.getDashboardSummary();
        expect(summary.total_active_projects).toBe(1);
        expect(summary.total_pipeline_value).toBe(10000);
        expect(summary.total_received).toBe(5000);
        expect(summary.outstanding).toBe(5000);
    });

    it('detects delayed projects based on due dates', async () => {
        const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
        
        const project = await engine.createProject({
            title: 'Overdue Proj',
            client_id: 'cli-000',
            client_name: 'Client',
            project_type: 'test',
            contract_value: 1000,
            start_date: '2026-03-01T00:00:00Z',
            deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            deliverables: [
                { title: 'Late file', due_date: pastDate }
            ]
        });

        await engine.updateDeliverableStatus(project.id, project.deliverables[0].id, 'in_progress');

        const currentProject = engine.getProject(project.id)!;
        expect(currentProject.health).toBe('delayed');
        
        const atRisk = engine.getAtRiskProjects();
        expect(atRisk.length).toBe(1);
        expect(atRisk[0].id).toBe(project.id);
    });
});
