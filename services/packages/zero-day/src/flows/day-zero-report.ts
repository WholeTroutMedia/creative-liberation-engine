/**
 * Day Zero GTM Report Generator — Helix D
 * T20260308-009: 5-dimension "All-Green" audit + GTM readiness report
 *
 * Produces the official Day Zero Report for any client intake submission.
 * Referenced by ZeroDayIntake → provisioner → this report flow.
 */

import { z } from 'zod';

// ─── Dimensions ───────────────────────────────────────────────────────────────

export const GTMDimensionId = z.enum([
  'ai_model_availability',
  'infrastructure_maturity',
  'hardware_accessibility',
  'financial_sustainability',
  'competitive_defensibility',
]);
export type GTMDimensionId = z.infer<typeof GTMDimensionId>;

export const GTMGrade = z.enum(['green', 'yellow', 'red']);
export type GTMGrade = z.infer<typeof GTMGrade>;

export const GTMGate = z.enum(['gate_0', 'gate_1', 'gate_2', 'gate_3', 'gate_4']);
export type GTMGate = z.infer<typeof GTMGate>;

export const DimensionResultSchema = z.object({
  id: GTMDimensionId,
  label: z.string(),
  grade: GTMGrade,
  score: z.number().min(0).max(100),
  findings: z.array(z.string()),
  risks: z.array(z.string()),
  recommendations: z.array(z.string()),
});
export type DimensionResult = z.infer<typeof DimensionResultSchema>;

export const DayZeroReportSchema = z.object({
  reportId: z.string(),
  clientName: z.string(),
  companyName: z.string(),
  industry: z.string(),
  generatedAt: z.string(),

  // 5-dimension audit
  dimensions: z.array(DimensionResultSchema),
  overallScore: z.number().min(0).max(100),
  overallGrade: GTMGrade,
  verdict: z.enum(['all_green', 'conditional', 'not_ready']),

  // GTM gate
  currentGate: GTMGate,
  nextGateRequirements: z.array(z.string()),

  // Executive summary
  executiveSummary: z.string(),
  topActions: z.array(z.string()),

  // 12-month financial projection
  financialProjection: z.object({
    monthlyGpuBudget: z.number(),
    annualLicensingCost: z.number(),
    projectedMrr: z.number(),
    breakEvenMonths: z.number(),
    roi12Month: z.number(),
  }),

  // Metadata
  generationMethod: z.enum(['ai_assisted', 'manual', 'hybrid']),
  recommendedNextStep: z.string(),
});
export type DayZeroReport = z.infer<typeof DayZeroReportSchema>;

// ─── Intake Input ─────────────────────────────────────────────────────────────

export interface DayZeroInput {
  clientName: string;
  companyName: string;
  industry: string;
  companySize: 'startup' | 'sme' | 'enterprise';
  primaryUseCase: string;
  deploymentType: 'hosted' | 'on-premise' | 'hybrid';
  sovereignRequired: boolean;
  complianceRequirements: string[];
  dataSourceTypes: string[];
  estimatedMonthlyBudget?: number;
}

// ─── Dimension Evaluators ─────────────────────────────────────────────────────

function evaluateAIAvailability(input: DayZeroInput): DimensionResult {
  const cloudBased = !input.sovereignRequired;
  const score = cloudBased ? 92 : 78;
  const grade: GTMGrade = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red';

  return DimensionResultSchema.parse({
    id: 'ai_model_availability',
    label: 'AI Model Availability',
    grade, score,
    findings: [
      'Gemini 2.5 Pro + Flash available via Vertex AI — production-ready',
      'Genkit v5 orchestration layer operational on NAS :4100',
      'SCRIBE v2 memory system with ChromaDB vector store active',
      cloudBased ? 'FAL.ai + Vertex AI provider abstraction confirmed' : 'Local Llama 3 + Kokoro TTS available for sovereign deployment',
    ],
    risks: input.sovereignRequired
      ? ['Local model hosting requires RTX 4090+ GPU — hardware procurement needed']
      : ['Cloud API dependency adds ~50ms latency for each LLM call'],
    recommendations: [
      'Use Genkit model-arbitrage for automatic fallback routing',
      'Implement 5-minute TTL cache for repeated LLM calls (already in mcp-router)',
    ],
  });
}

// ─── Genkit Connection ────────────────────────────────────────────────────────
import { ModelRouter } from '../utils/model-router.js';
import * as pdf from 'html-pdf-node';

const GENKIT_URL = process.env.GENKIT_URL || 'http://localhost:4100';

async function genkitGenerate(prompt: string, config?: { temperature?: number, model?: string }): Promise<string> {
  const resolvedModel = config?.model || ModelRouter.resolve('fast_extraction', 'ZERO_DAY_MODEL');
  const { model, ...cleanConfig } = config || {};
  const res = await fetch(`${GENKIT_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model: resolvedModel, config: Object.keys(cleanConfig).length ? cleanConfig : undefined }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Genkit generate failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.text;
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

export async function generateDayZeroPDF(report: DayZeroReport): Promise<Buffer> {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Day Zero GTM Report — ${report.clientName}</title>
      <style>
        body { font-family: -apple-system, sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
        .header { background: #0a0a0f; color: #f5f0e8; padding: 30px; border-radius: 8px 8px 0 0; }
        .title { font-size: 24px; font-weight: 800; }
        .score { font-size: 48px; font-weight: 800; float: right; margin-top: -10px; }
        .section { background: #fff; padding: 20px; border-bottom: 1px solid #eee; }
        .dim-title { font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        .dim-score { float: right; font-weight: 700; width: 40px; text-align: right; }
        .findings { margin-bottom: 10px; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .grade-green { background: #d4edda; color: #155724; }
        .grade-yellow { background: #fff3cd; color: #856404; }
        .grade-red { background: #f8d7da; color: #721c24; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="score">${report.overallScore}</div>
        <div class="title">Zero Day GTM Audit</div>
        <div>${report.clientName} (${report.companyName}) — ${new Date(report.generatedAt).toLocaleDateString()}</div>
      </div>
      <div class="section">
        <h3>Executive Summary <span class="badge grade-${report.overallGrade}">${report.verdict}</span></h3>
        <p>${report.executiveSummary}</p>
        <h4>Top Action Items</h4>
        <ul>${report.topActions.map(a => `<li>${a}</li>`).join('')}</ul>
      </div>
      ${report.dimensions.map(dim => `
      <div class="section">
        <div class="dim-score badge grade-${dim.grade}">${dim.score}/100</div>
        <div class="dim-title">${dim.label}</div>
        <ul class="findings">${dim.findings.map(f => `<li>${f}</li>`).join('')}</ul>
        <strong>Risks:</strong> <ul>${dim.risks.map(r => `<li>${r}</li>`).join('')}</ul>
        <strong>Recommendations:</strong> <ul>${dim.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
      </div>
      `).join('')}
    </body>
    </html>
  `;
  
  const file = { content: html };
  const options = { format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } };
  // @ts-ignore: html-pdf-node lacks proper type declarations
  return pdf.generatePdf(file, options) as Promise<Buffer>;
}

// ─── Report Generator ─────────────────────────────────────────────────────────

function deriveGate(score: number, compliance: string[]): GTMGate {
  if (score >= 90 && compliance.length === 0) return 'gate_2';
  if (score >= 80) return 'gate_1';
  if (score >= 65) return 'gate_0';
  return 'gate_0';
}

function deriveVerdict(score: number, dims: DimensionResult[]): DayZeroReport['verdict'] {
  const hasRed = dims.some(d => d.grade === 'red');
  if (hasRed) return 'not_ready';
  if (score >= 80) return 'all_green';
  return 'conditional';
}

/**
 * generateDayZeroReport — produces the official 5-dimension GTM audit via Gemini.
 */
export async function generateDayZeroReport(input: DayZeroInput): Promise<DayZeroReport> {
  const reportId = `dzr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const prompt = `
You are an expert Go-To-Market (GTM) AI strategist for the Creative Liberation Engine.
Analyze the following client intake data and provide a rigorous 5-dimension GTM audit.
The 5 dimensions MUST be strictly keyed as:
- 'ai_model_availability'
- 'infrastructure_maturity'
- 'hardware_accessibility'
- 'financial_sustainability'
- 'competitive_defensibility'

Client Data:
${JSON.stringify(input, null, 2)}

Provide the output as VALID JSON strictly matching this structure:
{
  "dimensions": [
    {
      "id": "<one of the 5 exact keys>",
      "label": "<human readable label>",
      "grade": "green" | "yellow" | "red",
      "score": <0-100>,
      "findings": ["finding 1", "finding 2"],
      "risks": ["risk 1"],
      "recommendations": ["rec 1"]
    }
    // ... all 5 dimensions ...
  ],
  "executiveSummary": "A concise paragraph summarizing GTM readiness.",
  "topActions": ["action 1", "action 2", "action 3"]
}
`;

  console.log(`[ZERO DAY] 📊 Calling Genkit for 5-dimension GTM audit for ${input.companyName}`);
  const rawText = await genkitGenerate(prompt, { model: ModelRouter.resolve('creative_synthesis') });
  
  // Extract JSON
  const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/) || rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse Genkit response as JSON.");
  const aiPayload = JSON.parse(jsonMatch[1] || jsonMatch[0]);

  const dimensions: DimensionResult[] = aiPayload.dimensions;
  
  const overallScore = Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length);
  const overallGrade: GTMGrade = overallScore >= 80 ? 'green' : overallScore >= 60 ? 'yellow' : 'red';
  const verdict = deriveVerdict(overallScore, dimensions);
  const currentGate = deriveGate(overallScore, input.complianceRequirements);

  const budgetNum = input.estimatedMonthlyBudget ?? 5000;
  const gpuBudget = input.sovereignRequired ? 3500 : 1200;
  const projectedMrr = input.companySize === 'enterprise' ? 15000 : input.companySize === 'sme' ? 5000 : 1500;
  const breakEvenMonths = Math.ceil((gpuBudget * 12 + 2400) / projectedMrr);

  const report = DayZeroReportSchema.parse({
    reportId,
    clientName: input.clientName,
    companyName: input.companyName,
    industry: input.industry,
    generatedAt: new Date().toISOString(),

    dimensions,
    overallScore,
    overallGrade,
    verdict,

    currentGate,
    nextGateRequirements: [
      'Resolve NAS Docker API mismatch for CI/CD automation',
      'Complete LEX contract signature',
      'Run onboarding simulation with sample data',
    ],

    executiveSummary: aiPayload.executiveSummary,
    topActions: aiPayload.topActions,

    financialProjection: {
      monthlyGpuBudget: gpuBudget,
      annualLicensingCost: 2400,
      projectedMrr,
      breakEvenMonths,
      roi12Month: Math.round(((projectedMrr * 12) - (gpuBudget * 12 + 2400)) / (gpuBudget * 12 + 2400) * 100),
    },

    generationMethod: 'ai_assisted',
    recommendedNextStep: 'Sign service agreement → begin onboarding simulation → activate agent network',
  });

  return report;
}

export default generateDayZeroReport;
