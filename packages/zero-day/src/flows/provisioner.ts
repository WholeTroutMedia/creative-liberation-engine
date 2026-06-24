/**
 * AgentNetworkProvisioner — W6 Zero-Day No-Code Intake
 *
 * Genkit flow that takes a Zero-Day intake submission and auto-provisions
 * a configured agent network for the client.
 *
 * Called by: ZeroDayIntake.tsx → intake route → this flow
 * Produces: agent config, Genkit service registration, LEX contract draft
 */

import { z } from 'zod';

// ─── Input Schema ─────────────────────────────────────────────────────────────

export const ProvisionerInputSchema = z.object({
    // Client info
    clientName: z.string().min(2),
    clientEmail: z.string().email(),
    companyName: z.string().min(2),
    industry: z.enum(['finance', 'healthcare', 'media', 'legal', 'real-estate', 'other']),
    companySize: z.enum(['startup', 'sme', 'enterprise']),

    // Use case
    primaryUseCase: z.string().min(10).max(500),
    dataSourceTypes: z.array(z.enum([
        'internal-docs', 'databases', 'apis', 'web-scraping',
        'real-time-feeds', 'crm', 'erp', 'clinical-records', 'other',
    ])),

    // Compliance requirements
    complianceRequirements: z.array(z.enum([
        'sox', 'hipaa', 'gdpr', 'pci-dss', 'sec-finra', 'none',
    ])).default([]),

    // Infrastructure preferences
    deploymentType: z.enum(['hosted', 'on-premise', 'hybrid']),
    sovereignRequired: z.boolean().default(false),

    // Blueprint
    blueprintId: z.string().optional()
        .describe('Pre-selected blueprint ID, or null for auto-detection'),

    // Session
    sessionId: z.string().optional(),
});

export type ProvisionerInput = z.infer<typeof ProvisionerInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

export const ProvisionerOutputSchema = z.object({
    provisioningId: z.string(),
    clientId: z.string(),
    status: z.enum(['pending', 'provisioning', 'active', 'failed']),
    assignedBlueprint: z.object({
        id: z.string(),
        name: z.string(),
        vertical: z.string(),
    }),
    agentTeam: z.array(z.object({
        agentId: z.string(),
        role: z.string(),
        status: z.enum(['initializing', 'ready', 'error']),
    })),
    dashboardUrl: z.string(),
    contractDraftUrl: z.string().optional(),
    estimatedReadyTime: z.string().describe('ISO timestamp'),
    constitutionalFlags: z.array(z.string()),
    onboardingSteps: z.array(z.string()),
    error: z.string().optional(),
});

export type ProvisionerOutput = z.infer<typeof ProvisionerOutputSchema>;

// ─── Blueprint Auto-Detection ────────────────────────────────────────────────

function detectBlueprint(input: ProvisionerInput): string {
    if (input.blueprintId) return input.blueprintId;

    const vertical = input.industry;
    if (vertical === 'finance') return 'finance-v1';
    if (vertical === 'healthcare') return 'healthcare-v1';
    if (vertical === 'media') return 'media-v1';
    return 'finance-v1'; // default to most complete blueprint
}

// ─── Agent Team Construction ─────────────────────────────────────────────────

function buildAgentTeam(blueprintId: string, compliance: string[]): Array<{
    agentId: string;
    role: string;
    status: 'initializing' | 'ready' | 'error';
}> {
    const baseTeam = [
        { agentId: 'ATHENA', role: 'Strategic Lead', status: 'initializing' as const },
        { agentId: 'VERA', role: 'Memory & Context', status: 'initializing' as const },
        { agentId: 'RELAY', role: 'Orchestration', status: 'initializing' as const },
    ];

    // Add blueprint-specific agents
    if (blueprintId.startsWith('finance')) {
        baseTeam.push(
            { agentId: 'SENTINEL', role: 'Risk Analysis', status: 'initializing' as const },
            { agentId: 'LEX', role: 'Compliance Review', status: 'initializing' as const },
            { agentId: 'COMPASS', role: 'SOX Oversight', status: 'initializing' as const },
        );
    } else if (blueprintId.startsWith('healthcare')) {
        baseTeam.push(
            { agentId: 'SENTINEL', role: 'Safety Validator', status: 'initializing' as const },
            { agentId: 'LEX', role: 'HIPAA Compliance', status: 'initializing' as const },
        );
    } else if (blueprintId.startsWith('media')) {
        baseTeam.push(
            { agentId: 'ATLAS', role: 'Creative Director', status: 'initializing' as const },
            { agentId: 'AURORA', role: 'Content Generation', status: 'initializing' as const },
            { agentId: 'BOLT', role: 'Production Build', status: 'initializing' as const },
        );
    }

    // Add LEX for all compliance-flagged clients
    if (compliance.includes('gdpr') && !baseTeam.find(a => a.agentId === 'LEX')) {
        baseTeam.push({ agentId: 'LEX', role: 'GDPR Compliance', status: 'initializing' as const });
    }

    return baseTeam;
}

// ─── Constitutional Flags ─────────────────────────────────────────────────────

function deriveConstitutionalFlags(input: ProvisionerInput): string[] {
    const flags: string[] = [];
    if (input.complianceRequirements.includes('sox')) flags.push('sox-compliance');
    if (input.complianceRequirements.includes('hipaa')) flags.push('hipaa-pii');
    if (input.complianceRequirements.includes('gdpr')) flags.push('gdpr-data-residency');
    if (input.complianceRequirements.includes('pci-dss')) flags.push('pci-dss-scoping');
    if (input.sovereignRequired) flags.push('sovereign-deployment-required');
    if (input.deploymentType === 'on-premise') flags.push('no-external-data-transfer');
    return flags;
}

// ─── Onboarding Steps ────────────────────────────────────────────────────────

function buildOnboardingSteps(input: ProvisionerInput): string[] {
    const steps = [
        'Review and sign the LEX-generated service agreement',
        'Confirm data source access credentials via the secure vault',
        'Review the assigned agent team and their capability scopes',
        'Run the onboarding simulation with sample data (constitutional review included)',
    ];

    if (input.deploymentType === 'on-premise') {
        steps.splice(1, 0, 'Schedule NAS deployment call with the infrastructure team');
    }

    if (input.sovereignRequired) {
        steps.push('Complete the Sovereign Deployment Setup (NAS + Forgejo CI/CD configuration)');
    }

    steps.push('Go live — activate your agent network and access the client dashboard');
    return steps;
}

// ─── Main Provisioner ─────────────────────────────────────────────────────────

export async function provisionAgentNetwork(
    input: ProvisionerInput
): Promise<ProvisionerOutput> {
    const provisioningId = `prov-${Date.now()}-${input.clientEmail.split('@')[0].slice(0, 8)}`;
    const clientId = `client-${Math.random().toString(36).slice(2, 10)}`;

    const blueprintId = detectBlueprint(input);
    const agentTeam = buildAgentTeam(blueprintId, input.complianceRequirements);
    const constitutionalFlags = deriveConstitutionalFlags(input);

    // Blueprint name lookup
    const verticalNames: Record<string, string> = {
        'finance-v1': 'Financial Intelligence Engine',
        'healthcare-v1': 'Clinical Decision Support Engine',
        'media-v1': 'Creative Production Intelligence Engine',
    };

    const estimatedReady = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // In production: this would call the genkit service to register the agent network,
    // emit an event to the provisioning queue, and trigger LEX contract generation.
    // For now: returns the full provisioning manifest.

    return {
        provisioningId,
        clientId,
        status: 'provisioning',
        assignedBlueprint: {
            id: blueprintId,
            name: verticalNames[blueprintId] ?? 'Custom Blueprint',
            vertical: blueprintId.split('-')[0] ?? 'custom',
        },
        agentTeam,
        dashboardUrl: `/client/${clientId}`,
        contractDraftUrl: `/client/${clientId}/contract`,
        estimatedReadyTime: estimatedReady.toISOString(),
        constitutionalFlags,
        onboardingSteps: buildOnboardingSteps(input),
    };
}
