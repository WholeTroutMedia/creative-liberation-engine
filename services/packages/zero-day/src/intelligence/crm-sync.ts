import { z } from 'zod';
import type { LeadScore } from './lead-scoring.js';
import type { ProspectOutput } from '../flows/prospect-pipeline.js';

// ─── CRM Sync Service — Zero-Day GTM Pipeline State ───────────────────────────
// Maintains an in-memory (Redis-ready) store of all prospect pipeline states.
// Designed for server environments; no browser dependencies.

export const PipelineStageSchema = z.enum([
    'lead',         // Raw signal ingested
    'qualified',    // Score ≥ 30, nurture sequence active
    'engaged',      // Score ≥ 80, discovery call booked
    'onboarding',   // onboardingDraftFlow triggered
    'contracted',   // Contract signed
    'active',       // Retainer active
    'churned',      // Account lost
]);

export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const PipelineRecordSchema = z.object({
    prospectId: z.string(),
    email: z.string().email(),
    name: z.string(),
    company: z.string().optional(),
    industry: z.string(),
    stage: PipelineStageSchema,
    leadScore: z.number().min(0).max(100),
    scoringFactors: z.array(z.string()),
    estimatedDealValue: z.number().optional(),
    outreachStrategy: z.string().optional(),
    nextAction: z.string().optional(),
    sourceChannel: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    tags: z.array(z.string()).default([]),
});

export type PipelineRecord = z.infer<typeof PipelineRecordSchema>;

export interface CRMSyncSummary {
    total: number;
    byStage: Record<PipelineStage, number>;
    averageScore: number;
    totalPipelineValue: number;
    recentActivity: PipelineRecord[];
}

// ── CRM Sync Service ───────────────────────────────────────────────────────────
export class CRMSyncService {
    private store = new Map<string, PipelineRecord>();

    /**
     * Upsert a prospect from pipeline flow output.
     */
    public upsertFromPipeline(
        input: { clientEmail: string; clientName: string; company?: string; industry: string; sourceChannel: string },
        output: ProspectOutput
    ): PipelineRecord {
        const now = new Date().toISOString();
        const existing = this.store.get(input.clientEmail);

        const stage = this.inferStage(output, existing?.stage);

        const record: PipelineRecord = {
            prospectId: output.prospectId,
            email: input.clientEmail,
            name: input.clientName,
            company: input.company,
            industry: input.industry,
            stage,
            leadScore: output.leadScore,
            scoringFactors: output.scoringFactors,
            estimatedDealValue: output.estimatedDealValue,
            outreachStrategy: output.outreachStrategy,
            nextAction: output.nextAction,
            sourceChannel: input.sourceChannel,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            tags: existing?.tags ?? [],
        };

        this.store.set(input.clientEmail, record);
        console.log(`[CRM Sync] Upserted ${input.clientEmail} → stage:${stage} score:${output.leadScore}`);
        return record;
    }

    /**
     * Update a record's stage directly (e.g., after contract signing).
     */
    public advanceStage(email: string, stage: PipelineStage): PipelineRecord | null {
        const record = this.store.get(email);
        if (!record) return null;
        record.stage = stage;
        record.updatedAt = new Date().toISOString();
        this.store.set(email, record);
        return record;
    }

    /**
     * Update a record from a LeadScore object (from the scoring engine).
     */
    public syncLeadScore(email: string, ls: LeadScore): PipelineRecord | null {
        const record = this.store.get(email);
        if (!record) return null;
        record.leadScore = ls.score;
        record.scoringFactors = ls.factors;
        record.stage = this.stageFromScore(ls.score, ls.recommendation, record.stage);
        record.updatedAt = new Date().toISOString();
        this.store.set(email, record);
        return record;
    }

    /**
     * Get all records, optionally filtered by stage.
     */
    public getAll(stage?: PipelineStage): PipelineRecord[] {
        const all = [...this.store.values()];
        return stage ? all.filter(r => r.stage === stage) : all;
    }

    /**
     * Get a single record.
     */
    public get(email: string): PipelineRecord | undefined {
        return this.store.get(email);
    }

    /**
     * Dashboard summary stats.
     */
    public getSummary(): CRMSummary {
        const all = this.getAll();
        const byStage = {} as Record<PipelineStage, number>;
        const stages: PipelineStage[] = ['lead', 'qualified', 'engaged', 'onboarding', 'contracted', 'active', 'churned'];
        for (const s of stages) byStage[s] = 0;

        let totalScore = 0;
        let totalValue = 0;

        for (const r of all) {
            byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
            totalScore += r.leadScore;
            totalValue += r.estimatedDealValue ?? 0;
        }

        const recentActivity = [...all]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 10);

        return {
            total: all.length,
            byStage,
            averageScore: all.length > 0 ? Math.round(totalScore / all.length) : 0,
            totalPipelineValue: totalValue,
            recentActivity,
        };
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private inferStage(output: ProspectOutput, currentStage?: PipelineStage): PipelineStage {
        // Don't downgrade already-advanced stages
        const protectedStages: PipelineStage[] = ['contracted', 'active', 'onboarding'];
        if (currentStage && protectedStages.includes(currentStage)) return currentStage;

        if (output.shouldTriggerOnboarding) return 'onboarding';
        return this.stageFromScore(output.leadScore, output.recommendation, currentStage);
    }

    private stageFromScore(
        score: number,
        recommendation: string,
        currentStage?: PipelineStage
    ): PipelineStage {
        const protectedStages: PipelineStage[] = ['contracted', 'active', 'onboarding'];
        if (currentStage && protectedStages.includes(currentStage)) return currentStage;
        if (recommendation === 'engage_now' || score >= 80) return 'engaged';
        if (recommendation === 'nurture' || score >= 30) return 'qualified';
        return 'lead';
    }

    /**
     * Flat upsert — for API routes and demo seeding (does not require ProspectOutput shape).
     */
    public upsert(record: {
        prospect_id: string;
        company?: string;
        contact_name: string;
        email: string;
        lead_score: { score: number; tier: string; signals: string[]; recommendations: string[]; evaluated_at: string };
        stage: PipelineStage;
        deal_value?: number;
        outreach_strategy?: string;
        next_action?: string;
        entered_at: string;
        updated_at: string;
        source: string;
    }): PipelineRecord {
        const existing = this.store.get(record.email);
        const pr: PipelineRecord = {
            prospectId: record.prospect_id,
            email: record.email,
            name: record.contact_name,
            company: record.company,
            industry: record.source,
            stage: record.stage,
            leadScore: record.lead_score.score,
            scoringFactors: record.lead_score.signals,
            estimatedDealValue: record.deal_value,
            outreachStrategy: record.outreach_strategy,
            nextAction: record.next_action,
            sourceChannel: record.source,
            createdAt: existing?.createdAt ?? record.entered_at,
            updatedAt: record.updated_at,
            tags: existing?.tags ?? [],
        };
        this.store.set(record.email, pr);
        return pr;
    }

    /**
     * Alias for getAll(stage) — matches server route API.
     */
    public getByStage(stage: PipelineStage): PipelineRecord[] {
        return this.getAll(stage);
    }
}


// Shared exported type alias to match summary return
export type CRMSummary = CRMSyncSummary;

export const crmSync = new CRMSyncService();
