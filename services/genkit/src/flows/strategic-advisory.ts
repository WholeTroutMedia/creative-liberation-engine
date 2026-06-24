import { z } from 'genkit';
import { ai } from '../index.js';
import { webResearchFlow } from './web-research.js';

export const LuminousTierSchema = z.enum(['free', 'pro', 'sovereign']);
export type LuminousTier = z.infer<typeof LuminousTierSchema>;

const ScorecardItemSchema = z.object({
  dimension: z.string(),
  score: z.number().min(0).max(100),
  rationale: z.string(),
});

const RecommendationSchema = z.object({
  recommendation: z.string(),
  owner: z.string(),
  timeline: z.string(),
  kpi: z.string(),
  dependencies: z.array(z.string()),
  centralizationRisk: z.number().min(0).max(100),
  vendorLockInRisk: z.number().min(0).max(100),
});

const RiskSchema = z.object({
  name: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  likelihood: z.enum(['low', 'medium', 'high']),
  mitigation: z.string(),
});

const EvidenceSchema = z.object({
  claim: z.string(),
  level: z.enum(['observed', 'inferred', 'benchmarked', 'speculative']),
  source: z.string(),
  confidence: z.number().min(0).max(100),
});

export const StrategicReportTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  minTier: LuminousTierSchema,
  industryStandard: z.string(),
  sections: z.array(z.string()),
});

export const StrategicConsultInputSchema = z.object({
  stockSymbol: z.string().optional(),
  companyName: z.string().optional(),
  url: z.string().optional(),
  pdfText: z.string().optional(),
  pdfUrl: z.string().optional(),
  idea: z.string().optional(),
  userQuestion: z.string().optional(),
  requestedTemplates: z.array(z.string()).optional(),
  tier: LuminousTierSchema.default('free'),
  includeIdeaComparison: z.boolean().default(true),
  ephemeral: z.boolean().default(true).describe('No memory writes when true'),
});

const GeneratedReportSchema = z.object({
  templateId: z.string(),
  title: z.string(),
  executiveTakeaway: z.string(),
  hypotheses: z.array(z.object({
    hypothesis: z.string(),
    confidence: z.number().min(0).max(100),
  })),
  findings: z.array(z.string()),
  scorecard: z.array(ScorecardItemSchema),
  recommendations: z.array(RecommendationSchema),
  risks: z.array(RiskSchema),
  evidence: z.array(EvidenceSchema),
  ideaComparison: z.object({
    overlap: z.array(z.string()),
    differentiators: z.array(z.string()),
    viabilityVerdict: z.string(),
    confidence: z.number().min(0).max(100),
  }).optional(),
});

export const StrategicConsultOutputSchema = z.object({
  runId: z.string(),
  profile: z.object({
    stockSymbol: z.string().nullable(),
    companyName: z.string().nullable(),
    url: z.string().nullable(),
    hasPdfInput: z.boolean(),
    hasIdea: z.boolean(),
  }),
  tier: LuminousTierSchema,
  templatesUsed: z.array(StrategicReportTemplateSchema),
  lockedTemplates: z.array(StrategicReportTemplateSchema),
  reports: z.array(GeneratedReportSchema),
  research: z.object({
    used: z.boolean(),
    model: z.string().nullable(),
    citations: z.array(z.string()),
    summary: z.string(),
  }),
  governance: z.object({
    ephemeral: z.boolean(),
    memoryWriteSkipped: z.boolean(),
    reasoningStandard: z.string(),
  }),
});

export type StrategicConsultInput = z.infer<typeof StrategicConsultInputSchema>;
export type StrategicConsultOutput = z.infer<typeof StrategicConsultOutputSchema>;

const TIER_RANK: Record<LuminousTier, number> = {
  free: 0,
  pro: 1,
  sovereign: 2,
};

export const STRATEGIC_REPORT_TEMPLATES: z.infer<typeof StrategicReportTemplateSchema>[] = [
  {
    id: 'mckinsey-strategy',
    name: 'Decision Pyramid Strategy Brief',
    description: 'Decision-first strategic narrative with MECE issue trees and quantified actions.',
    minTier: 'free',
    industryStandard: 'Top-tier strategy consulting style',
    sections: ['Executive takeaway', 'Issue tree', 'Findings', 'Actions', 'Risks'],
  },
  {
    id: 'big4-risk-controls',
    name: 'Risk And Controls Assessment',
    description: 'Control design and operating effectiveness benchmark with remediation sequence.',
    minTier: 'pro',
    industryStandard: 'Big 4 risk advisory style',
    sections: ['Control inventory', 'Gap map', 'Severity profile', 'Remediation roadmap'],
  },
  {
    id: 'gartner-capability-maturity',
    name: 'Capability Maturity Roadmap',
    description: 'Current-vs-target maturity grading by business capability and architecture layer.',
    minTier: 'pro',
    industryStandard: 'Capability maturity model approach',
    sections: ['Capability stack', 'Maturity scores', 'Target state', 'Migration steps'],
  },
  {
    id: 'pe-commercial-diligence',
    name: 'Commercial Diligence Pack',
    description: 'Market attractiveness, demand durability, and go-to-market robustness assessment.',
    minTier: 'pro',
    industryStandard: 'Private equity commercial diligence',
    sections: ['Market map', 'Growth vectors', 'Competitive pressure', 'Investment view'],
  },
  {
    id: 'pe-technical-diligence',
    name: 'Technical Diligence Pack',
    description: 'Architecture scalability, delivery velocity, and technical debt risk posture.',
    minTier: 'pro',
    industryStandard: 'Private equity technical diligence',
    sections: ['Architecture posture', 'Engineering velocity', 'Debt burden', 'Critical remediations'],
  },
  {
    id: 'cfo-operating-review',
    name: 'CFO Operating Review',
    description: 'Unit economics, scenario planning, and execution KPI review for operators.',
    minTier: 'pro',
    industryStandard: 'CFO operating cadence',
    sections: ['Baseline economics', 'Scenario tree', 'Cash-risk trajectory', 'Plan of record'],
  },
  {
    id: 'ciso-board-brief',
    name: 'CISO Board Brief',
    description: 'Threat exposure and control readiness mapped to board-level risk language.',
    minTier: 'sovereign',
    industryStandard: 'Board cybersecurity briefing',
    sections: ['Threat model', 'Exposure score', 'Control status', 'Board actions'],
  },
  {
    id: 'regulatory-readiness',
    name: 'Regulatory Readiness Matrix',
    description: 'Policy and evidence readiness across SOC 2, ISO 27001, GDPR, and CCPA lenses.',
    minTier: 'sovereign',
    industryStandard: 'Enterprise compliance readiness',
    sections: ['Framework mapping', 'Evidence status', 'Gap closure plan', 'Audit readiness'],
  },
  {
    id: 'board-value-creation',
    name: 'Board Value Creation Plan',
    description: '12-18 month value creation initiatives with sequencing and governance structure.',
    minTier: 'sovereign',
    industryStandard: 'Board transformation planning',
    sections: ['Value levers', 'Initiative stack', 'Execution governance', 'Risk-adjusted outcomes'],
  },
  {
    id: 'vendor-sovereignty-audit',
    name: 'Vendor Sovereignty Audit',
    description: 'Centralization and lock-in analysis with sovereignty migration pathways.',
    minTier: 'sovereign',
    industryStandard: 'Sovereign infrastructure review',
    sections: ['Dependency graph', 'Lock-in profile', 'Exit feasibility', 'Sovereignty roadmap'],
  },
];

function resolveTemplates(tier: LuminousTier, requestedTemplates?: string[]) {
  const byTier = STRATEGIC_REPORT_TEMPLATES.filter(
    (template) => TIER_RANK[tier] >= TIER_RANK[template.minTier],
  );
  const locked = STRATEGIC_REPORT_TEMPLATES.filter(
    (template) => TIER_RANK[tier] < TIER_RANK[template.minTier],
  );
  if (!requestedTemplates || requestedTemplates.length === 0) {
    return { selected: byTier, locked };
  }

  const allowSet = new Set(requestedTemplates);
  return {
    selected: byTier.filter((template) => allowSet.has(template.id)),
    locked: locked.filter((template) => allowSet.has(template.id)),
  };
}

function buildResearchQuery(input: StrategicConsultInput): string {
  const anchors = [
    input.stockSymbol ? `stock symbol ${input.stockSymbol}` : '',
    input.companyName ? `company ${input.companyName}` : '',
    input.url ? `url ${input.url}` : '',
    input.userQuestion ? `question ${input.userQuestion}` : '',
    input.idea ? `idea ${input.idea}` : '',
  ].filter(Boolean);

  if (anchors.length === 0) {
    return 'Generate enterprise strategy benchmarks for a digital-first business and sovereign AI operations.';
  }
  return `Create a strategic benchmark dossier from these anchors: ${anchors.join(' | ')}. Include market signals, competitive positioning, risk factors, and execution benchmarks.`;
}

export const strategicConsultFlow = ai.defineFlow(
  {
    name: 'strategicConsult',
    inputSchema: StrategicConsultInputSchema,
    outputSchema: StrategicConsultOutputSchema,
  },
  async (input): Promise<StrategicConsultOutput> => {
    const runId = `strategic_${Date.now()}`;
    const { selected, locked } = resolveTemplates(input.tier, input.requestedTemplates);
    const researchQuery = buildResearchQuery(input);

    let researchSummary = 'Research unavailable.';
    let researchCitations: string[] = [];
    let researchModel: string | null = null;
    let researchUsed = false;

    try {
      const research = await webResearchFlow({
        query: researchQuery,
        depth: input.tier === 'free' ? 'standard' : 'deep',
      });
      if (research.success) {
        researchSummary = research.answer;
        researchCitations = research.citations;
        researchModel = research.model;
        researchUsed = true;
      } else {
        researchSummary = research.errorMessage ?? researchSummary;
      }
    } catch (error) {
      researchSummary = error instanceof Error ? error.message : String(error);
    }

    const reportPromises = selected.map(async (template) => {
      const generation = await ai.generate({
        model: process.env.GENKIT_PRO_MODEL || 'googleai/gemini-2.5-pro',
        system: `You are an enterprise strategy operating system generating ${template.industryStandard} analysis.
Use a hypothesis-led structure and produce practical recommendations.
Every recommendation must include owner, timeline, KPI, dependencies, centralization risk, and lock-in risk.
Evidence entries must include one of: observed, inferred, benchmarked, speculative.`,
        prompt: `Template: ${template.name}
Template description: ${template.description}
Required sections: ${template.sections.join(', ')}

Input profile:
- stockSymbol: ${input.stockSymbol ?? 'n/a'}
- companyName: ${input.companyName ?? 'n/a'}
- url: ${input.url ?? 'n/a'}
- userQuestion: ${input.userQuestion ?? 'n/a'}
- idea: ${input.idea ?? 'n/a'}
- includeIdeaComparison: ${input.includeIdeaComparison}

Reference data:
${researchSummary}

If PDF text is provided, treat it as primary source:
${input.pdfText ? input.pdfText.slice(0, 24000) : 'No PDF text provided.'}

Return JSON strictly matching the provided schema.`,
        output: { schema: GeneratedReportSchema },
      });

      return generation.output as z.infer<typeof GeneratedReportSchema>;
    });

    const reports = await Promise.all(reportPromises);

    return {
      runId,
      profile: {
        stockSymbol: input.stockSymbol ?? null,
        companyName: input.companyName ?? null,
        url: input.url ?? null,
        hasPdfInput: Boolean(input.pdfText || input.pdfUrl),
        hasIdea: Boolean(input.idea),
      },
      tier: input.tier,
      templatesUsed: selected,
      lockedTemplates: locked,
      reports,
      research: {
        used: researchUsed,
        model: researchModel,
        citations: researchCitations,
        summary: researchSummary,
      },
      governance: {
        ephemeral: input.ephemeral,
        memoryWriteSkipped: input.ephemeral,
        reasoningStandard: 'decision-first + hypothesis-led + evidence-ladder + sovereignty lens',
      },
    };
  },
);
