import { z } from 'zod';
import { visionCuratorFlow, type VisionScore } from '../intelligence/vision-curator.js';
import { type CreativeDNA } from '../intelligence/creative-dna.js';// ─── ZERO DAY — Delivery Engine ───────────────────────────────────────────────
// Tracks every deliverable, automates follow-up, surfaces blockers.
// STUDIO agent's project management backbone.

export const DeliverableStatusSchema = z.enum([
    'not_started',
    'in_progress',
    'internal_review',
    'sent_to_client',
    'client_reviewing',
    'revision_requested',
    'approved',
    'complete',
]);

export const DeliverablePrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const DeliverableSchema = z.object({
    id: z.string(),
    project_id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    priority: DeliverablePrioritySchema.default('medium'),
    status: DeliverableStatusSchema.default('not_started'),
    assigned_to: z.string().optional(),
    due_date: z.string().optional(),
    delivered_at: z.string().optional(),
    approved_at: z.string().optional(),
    revision_count: z.number().default(0),
    max_revisions: z.number().default(2),
    client_feedback: z.string().optional(),
    file_urls: z.array(z.string()).default([]),
    created_at: z.string(),
    updated_at: z.string(),
});

export const ProjectStatusSchema = z.enum([
    'intake',
    'proposal',
    'contract_sent',
    'contract_signed',
    'deposit_received',
    'active',
    'on_hold',
    'final_review',
    'complete',
    'cancelled',
]);

export const ProjectSchema = z.object({
    id: z.string(),
    title: z.string(),
    client_id: z.string(),
    client_name: z.string(),
    status: ProjectStatusSchema.default('intake'),
    project_type: z.string(),
    contract_value: z.number(),
    amount_received: z.number().default(0),
    start_date: z.string(),
    deadline: z.string(),
    deliverables: z.array(DeliverableSchema).default([]),
    health: z.enum(['on_track', 'at_risk', 'delayed', 'blocked']).default('on_track'),
    health_reason: z.string().optional(),
    auto_follow_up_enabled: z.boolean().default(true),
    created_at: z.string(),
    updated_at: z.string(),
});

export type Deliverable = z.infer<typeof DeliverableSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type DeliverableStatus = z.infer<typeof DeliverableStatusSchema>;

// ─── Delivery Engine ──────────────────────────────────────────────────────────

export class DeliveryEngine {
    private projects = new Map<string, Project>();

    async createProject(input: {
        title: string;
        client_id: string;
        client_name: string;
        project_type: string;
        contract_value: number;
        start_date: string;
        deadline: string;
        deliverables?: Array<{ title: string; description?: string; due_date?: string; priority?: string }>;
    }): Promise<Project> {
        const projectId = `proj-${Date.now()}`;
        const now = new Date().toISOString();

        const deliverables: Deliverable[] = (input.deliverables ?? []).map((d: { title: string; description?: string; due_date?: string; priority?: string }, i: number) =>
            DeliverableSchema.parse({
                id: `${projectId}-deliv-${i + 1}`,
                project_id: projectId,
                title: d.title,
                description: d.description,
                priority: d.priority ?? 'medium',
                due_date: d.due_date,
                created_at: now,
                updated_at: now,
            })
        );

        const project = ProjectSchema.parse({
            id: projectId,
            title: input.title,
            client_id: input.client_id,
            client_name: input.client_name,
            project_type: input.project_type,
            contract_value: input.contract_value,
            start_date: input.start_date,
            deadline: input.deadline,
            deliverables,
            created_at: now,
            updated_at: now,
        });

        this.projects.set(projectId, project);
        console.log(`[ZERO DAY] ✅ Project created: ${project.title} (${projectId})`);
        return project;
    }

    async updateDeliverableStatus(
        projectId: string,
        delivId: string,
        status: DeliverableStatus,
        clientFeedback?: string
    ): Promise<Deliverable> {
        const project = this.projects.get(projectId);
        if (!project) throw new Error(`Project ${projectId} not found`);

        const delivIdx = project.deliverables.findIndex((d: Deliverable) => d.id === delivId);
        if (delivIdx === -1) throw new Error(`Deliverable ${delivId} not found`);

        const now = new Date().toISOString();
        const deliv = project.deliverables[delivIdx];

        const updated: Deliverable = {
            ...deliv,
            status,
            client_feedback: clientFeedback,
            updated_at: now,
            ...(status === 'sent_to_client' ? { delivered_at: now } : {}),
            ...(status === 'approved' ? { approved_at: now } : {}),
            ...(status === 'revision_requested' ? { revision_count: deliv.revision_count + 1 } : {}),
        };

        project.deliverables[delivIdx] = updated;

        // Auto-compute project health
        project.health = this.computeProjectHealth(project);
        project.updated_at = now;

        console.log(`[ZERO DAY] 📋 ${deliv.title}: ${deliv.status} → ${status}`);

        // Self-healing: if awaiting client >5 days, flag it
        if (status === 'sent_to_client') {
            setTimeout(() => {
                const current = project.deliverables[delivIdx];
                if (current.status === 'sent_to_client') {
                    project.health = 'at_risk';
                    project.health_reason = `${deliv.title} has been awaiting client review for 5+ days`;
                    console.log(`[ZERO DAY] ⚠️ Auto-follow-up needed: ${deliv.title} awaiting client`);
                    // In production: trigger RELAY to send follow-up via Slack/email
                }
            }, 5 * 24 * 60 * 60 * 1000); // 5 days
        }

        return updated;
    }

    async autoCurateDeliverable(projectId: string, delivId: string, images: { id: string; url: string; mimeType: string }[], project_dna?: CreativeDNA): Promise<{
        curated_counts: { hero: number, gallery: number, reject: number };
        scores: Record<string, VisionScore>;
    }> {
        const project = this.projects.get(projectId);
        if (!project) throw new Error(`Project ${projectId} not found`);

        const delivIdx = project.deliverables.findIndex((d: Deliverable) => d.id === delivId);
        if (delivIdx === -1) throw new Error(`Deliverable ${delivId} not found`);

        const result = await visionCuratorFlow({
            images,
            project_dna: project_dna?.vector,
            target_audience: project_dna?.aesthetic_label
        });

        console.log(`[ZERO DAY] 👁️  Vision Curation complete for ${delivId}: ${result.hero_ids.length} heroes, ${result.gallery_ids.length} gallery, ${result.rejected_ids.length} rejected`);

        return {
            curated_counts: {
                hero: result.hero_ids.length,
                gallery: result.gallery_ids.length,
                reject: result.rejected_ids.length
            },
            scores: result.results
        };
    }

    async completeProject(projectId: string): Promise<Project> {
        const project = this.projects.get(projectId);
        if (!project) throw new Error(`Project ${projectId} not found`);
        project.status = 'complete';
        project.updated_at = new Date().toISOString();
        console.log(`[ZERO DAY] 🎉 Project completed: ${project.title}`);
        return project;
    }

    updateProjectStatus(projectId: string, status: ProjectStatus): Project {
        const project = this.projects.get(projectId);
        if (!project) throw new Error(`Project ${projectId} not found`);
        project.status = status;
        project.updated_at = new Date().toISOString();
        return project;
    }

    recordPayment(projectId: string, amount: number): Project {
        const project = this.projects.get(projectId);
        if (!project) throw new Error(`Project ${projectId} not found`);
        project.amount_received += amount;
        project.updated_at = new Date().toISOString();
        console.log(`[ZERO DAY] 💰 Payment recorded: $${amount} for ${project.title} (total: $${project.amount_received})`);
        return project;
    }

    getProject(projectId: string): Project | undefined {
        return this.projects.get(projectId);
    }

    listProjects(status?: ProjectStatus): Project[] {
        const all = Array.from(this.projects.values());
        return status ? all.filter((p) => p.status === status) : all;
    }

    getAtRiskProjects(): Project[] {
        return Array.from(this.projects.values()).filter((p) =>
            p.health === 'at_risk' || p.health === 'delayed' || p.health === 'blocked'
        );
    }

    private computeProjectHealth(project: Project): Project['health'] {
        const now = new Date();
        const deadline = new Date(project.deadline);
        const daysUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

        // Check overdue deliverables
        const overdue = project.deliverables.filter((d: Deliverable) => {
            if (!d.due_date) return false;
            return new Date(d.due_date) < now && d.status !== 'approved' && d.status !== 'complete';
        });

        if (overdue.length > 0) return 'delayed';

        // Check revision ceiling hit
        const atRevCap = project.deliverables.find((d: Deliverable) => d.revision_count >= d.max_revisions);
        if (atRevCap) return 'blocked';

        // Check timeline risk
        const notStarted = project.deliverables.filter((d: Deliverable) => d.status === 'not_started').length;
        const totalDeliverables = project.deliverables.length;

        if (daysUntilDeadline < 7 && notStarted > totalDeliverables * 0.3) return 'at_risk';
        if (daysUntilDeadline < 3) return 'at_risk';

        return 'on_track';
    }

    // ── Dashboard Summary ────────────────────────────────────────────────────

    getDashboardSummary() {
        const all = Array.from(this.projects.values());
        const active = all.filter((p) => p.status === 'active');
        const atRisk = all.filter((p) => p.health !== 'on_track' && p.status === 'active');
        const totalValue = active.reduce((sum, p) => sum + p.contract_value, 0);
        const totalReceived = active.reduce((sum, p) => sum + p.amount_received, 0);
        const pendingDeliverables = active.flatMap((p: Project) =>
            p.deliverables.filter((d: Deliverable) => d.status === 'client_reviewing')
        );

        return {
            total_active_projects: active.length,
            at_risk_count: atRisk.length,
            total_pipeline_value: totalValue,
            total_received: totalReceived,
            outstanding: totalValue - totalReceived,
            pending_client_approval: pendingDeliverables.length,
            at_risk_projects: atRisk.map((p) => ({ id: p.id, title: p.title, health_reason: p.health_reason })),
        };
    }
}
