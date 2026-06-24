import { z } from 'zod';

// ─── ZERO DAY — ECHO Client Intelligence Profile ──────────────────────────────
// ECHO agent's persistent memory for every client.
// The longer the engine runs, the smarter it gets for each client.

export const CommunicationStyleSchema = z.enum(['brief', 'detailed', 'visual', 'metrics_driven', 'narrative']);
export const ApprovalSpeedSchema = z.enum(['same_day', 'within_2_days', 'within_a_week', 'slow']);
export const RelationshipHealthSchema = z.enum(['at_risk', 'neutral', 'healthy', 'excellent']);

export const RevisionPatternSchema = z.object({
    category: z.string().describe('Type of revision: copy, design, scope, timeline'),
    frequency: z.number().describe('How often in last 10 projects (0-10)'),
    typical_feedback: z.string().describe('Common feedback phrasing'),
});

export const SatisfactionSignalSchema = z.object({
    signal_type: z.enum(['response_speed', 'approval_rate', 'communication_tone', 'referral_sent', 'scope_increase', 'repeat_project']),
    value: z.number().describe('Normalized score 0-1'),
    recorded_at: z.string().datetime(),
    project_id: z.string().optional(),
    note: z.string().optional(),
});

export const ClientPreferencesSchema = z.object({
    contact_time: z.object({
        days: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])),
        hours_start: z.number().min(0).max(23),
        hours_end: z.number().min(0).max(23),
        timezone: z.string(),
    }),
    report_format: z.enum(['executive_summary', 'detailed_walkthrough', 'video_only', 'async_loom']),
    meeting_preference: z.enum(['minimal', 'weekly_check_in', 'daily_standup', 'ad_hoc']),
    feedback_style: z.enum(['direct', 'collaborative', 'iterative', 'approval_based']),
});

export const ClientIntelligenceSchema = z.object({
    client_id: z.string(),
    client_email: z.string().email(),
    client_name: z.string(),
    company: z.string().optional(),
    industry: z.string().optional(),

    // Behavioral Intelligence
    communication_style: CommunicationStyleSchema,
    approval_speed: ApprovalSpeedSchema,
    revision_patterns: z.array(RevisionPatternSchema),
    preferences: ClientPreferencesSchema,

    // Relationship
    relationship_health: RelationshipHealthSchema,
    satisfaction_signals: z.array(SatisfactionSignalSchema),
    satisfaction_score: z.number().min(0).max(1).describe('Computed from signals'),
    nps_estimate: z.number().min(-100).max(100).describe('Estimated NPS based on behavior'),

    // Financial Intelligence
    lifetime_value: z.number().describe('Total revenue from this client'),
    average_project_value: z.number(),
    budget_flexibility: z.enum(['fixed', 'somewhat_flexible', 'flexible', 'very_flexible']),
    payment_reliability: z.enum(['always_late', 'sometimes_late', 'reliable', 'early_payer']),

    // Growth Intelligence
    upsell_readiness: z.boolean(),
    upsell_opportunities: z.array(z.string()).describe('Specific upsell ideas based on current engagement'),
    referral_probability: z.number().min(0).max(1),
    churn_risk: z.enum(['low', 'medium', 'high']).describe('Risk of client leaving'),

    // History
    project_ids: z.array(z.string()),
    total_projects: z.number(),
    first_project_date: z.string().optional(),
    last_activity_date: z.string(),

    // ECHO Metadata
    profile_version: z.number(),
    last_updated: z.string().datetime(),
    auto_generated_notes: z.array(z.string()),
});

export type ClientIntelligence = z.infer<typeof ClientIntelligenceSchema>;

// ─── Default Profile Factory ───────────────────────────────────────────────────

export function createDefaultProfile(
    clientId: string,
    clientEmail: string,
    clientName: string
): ClientIntelligence {
    return {
        client_id: clientId,
        client_email: clientEmail,
        client_name: clientName,
        communication_style: 'detailed',
        approval_speed: 'within_2_days',
        revision_patterns: [],
        preferences: {
            contact_time: {
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                hours_start: 9,
                hours_end: 17,
                timezone: 'America/New_York',
            },
            report_format: 'detailed_walkthrough',
            meeting_preference: 'weekly_check_in',
            feedback_style: 'collaborative',
        },
        relationship_health: 'neutral',
        satisfaction_signals: [],
        satisfaction_score: 0.5,
        nps_estimate: 0,
        lifetime_value: 0,
        average_project_value: 0,
        budget_flexibility: 'somewhat_flexible',
        payment_reliability: 'reliable',
        upsell_readiness: false,
        upsell_opportunities: [],
        referral_probability: 0.3,
        churn_risk: 'low',
        project_ids: [],
        total_projects: 0,
        last_activity_date: new Date().toISOString(),
        profile_version: 1,
        last_updated: new Date().toISOString(),
        auto_generated_notes: [],
    };
}

// ─── Signal Processor ─────────────────────────────────────────────────────────

export function recordSignal(
    profile: ClientIntelligence,
    signalType: z.infer<typeof SatisfactionSignalSchema>['signal_type'],
    value: number,
    note?: string,
    projectId?: string
): ClientIntelligence {
    const signal: z.infer<typeof SatisfactionSignalSchema> = {
        signal_type: signalType,
        value,
        recorded_at: new Date().toISOString(),
        project_id: projectId,
        note,
    };

    const signals = [...profile.satisfaction_signals, signal];
    const avgSatisfaction = signals.reduce((sum, s) => sum + s.value, 0) / signals.length;
    const nps = (avgSatisfaction - 0.5) * 200; // Maps 0-1 to -100 to 100

    const health: z.infer<typeof RelationshipHealthSchema> =
        avgSatisfaction >= 0.85 ? 'excellent'
            : avgSatisfaction >= 0.65 ? 'healthy'
                : avgSatisfaction >= 0.4 ? 'neutral'
                    : 'at_risk';

    return {
        ...profile,
        satisfaction_signals: signals.slice(-50), // Keep last 50 signals
        satisfaction_score: Math.round(avgSatisfaction * 100) / 100,
        nps_estimate: Math.round(nps),
        relationship_health: health,
        upsell_readiness: avgSatisfaction >= 0.75 && profile.total_projects >= 1,
        referral_probability: avgSatisfaction >= 0.85 ? 0.7 : avgSatisfaction >= 0.7 ? 0.4 : 0.1,
        churn_risk: avgSatisfaction < 0.35 ? 'high' : avgSatisfaction < 0.55 ? 'medium' : 'low',
        last_updated: new Date().toISOString(),
    };
}

// ─── Insight Generator ────────────────────────────────────────────────────────

export function generateECHOInsights(profile: ClientIntelligence): string[] {
    const insights: string[] = [];

    if (profile.churn_risk === 'high') {
        insights.push(`⚠️ CHURN RISK: ${profile.client_name} shows disengagement signals. Proactive outreach recommended.`);
    }

    if (profile.upsell_readiness && profile.upsell_opportunities.length > 0) {
        insights.push(`💡 UPSELL: ${profile.client_name} is ready for expansion. Opportunity: ${profile.upsell_opportunities[0]}`);
    }

    if (profile.referral_probability >= 0.6) {
        insights.push(`🌟 REFERRAL: ${profile.client_name} has high satisfaction. Referral request recommended.`);
    }

    if (profile.payment_reliability === 'always_late') {
        insights.push(`💰 PAYMENT: ${profile.client_name} consistently pays late. Consider upfront payment terms.`);
    }

    const highFreqRevision = profile.revision_patterns.find((r) => r.frequency >= 7);
    if (highFreqRevision) {
        insights.push(`✏️ REVISION PATTERN: ${profile.client_name} frequently requests ${highFreqRevision.category} changes. Brief more thoroughly upfront.`);
    }

    if (profile.approval_speed === 'slow') {
        insights.push(`⏱️ TIMELINE: ${profile.client_name} takes time to approve. Build extra buffer into project timelines.`);
    }

    return insights;
}

// ─── ECHO Profile Store (in-memory, ChromaDB-backed in production) ────────────

export class ECHOProfileStore {
    private profiles = new Map<string, ClientIntelligence>();

    async get(clientId: string): Promise<ClientIntelligence | null> {
        return this.profiles.get(clientId) ?? null;
    }

    async save(profile: ClientIntelligence): Promise<void> {
        this.profiles.set(profile.client_id, profile);
        // In production: persist to ChromaDB via KEEPER
    }

    async getOrCreate(clientId: string, email: string, name: string): Promise<ClientIntelligence> {
        const existing = await this.get(clientId);
        if (existing) return existing;
        const fresh = createDefaultProfile(clientId, email, name);
        await this.save(fresh);
        return fresh;
    }

    async recordProjectComplete(clientId: string, projectId: string, projectValue: number): Promise<ClientIntelligence> {
        const profile = await this.get(clientId);
        if (!profile) throw new Error(`Client ${clientId} not found`);

        const updated: ClientIntelligence = {
            ...profile,
            project_ids: [...profile.project_ids, projectId],
            total_projects: profile.total_projects + 1,
            lifetime_value: profile.lifetime_value + projectValue,
            average_project_value: (profile.lifetime_value + projectValue) / (profile.total_projects + 1),
            last_activity_date: new Date().toISOString(),
            last_updated: new Date().toISOString(),
        };

        // Signal: completed a project = positive satisfaction
        const withSignal = recordSignal(updated, 'repeat_project', 0.8, `Project ${projectId} completed`, projectId);
        await this.save(withSignal);
        return withSignal;
    }

    getInsights(clientId: string): string[] {
        const profile = this.profiles.get(clientId);
        return profile ? generateECHOInsights(profile) : [];
    }
}
