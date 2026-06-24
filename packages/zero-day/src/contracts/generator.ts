import { z } from 'zod';
import htmlPdf from 'html-pdf-node';
import { notifier } from '../notifications/notifier.js';
import { ModelRouter } from '../utils/model-router.js';

// ─── Genkit HTTP Client ───────────────────────────────────────────────────────
const GENKIT_URL = process.env.GENKIT_URL || 'http://localhost:4100';
async function genkitGenerate(prompt: string, config?: { temperature?: number, model?: string }): Promise<string> {
    const resolvedModel = config?.model || ModelRouter.resolve('legal_reasoning', 'CONTRACT_MODEL');
    const { model, ...cleanConfig } = config || {};
    const res = await fetch(`${GENKIT_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: resolvedModel, config: Object.keys(cleanConfig).length ? cleanConfig : undefined }),
    });
    if (!res.ok) throw new Error(`Genkit generate failed (${res.status}): ${await res.text()}`);
    const data = await res.json() as { text: string };
    return data.text;
}

// ─── ZERO DAY — LEX Contract Generator ───────────────────────────────────────
// LEX agent's automated contract generation system.
// Produces legally-structured, jurisdiction-aware contracts from project intent.

export const ContractTypeSchema = z.enum([
    'digital_product_development',
    'brand_identity',
    'broadcast_production',
    'retainer',
    'campaign_creative',
    'photography_video',
    'social_media_management',
    'consulting',
    'licensing',
]);

export const JurisdictionSchema = z.enum(['us_general', 'california', 'new_york', 'uk', 'eu', 'canada']);

export const ContractInputSchema = z.object({
    contract_type: ContractTypeSchema,
    agency_name: z.string(),
    agency_address: z.string(),
    client_name: z.string(),
    client_address: z.string(),
    client_email: z.string().email().optional(),
    project_title: z.string(),
    scope_of_work: z.string(),
    deliverables: z.array(z.string()),
    total_value: z.number(),
    payment_schedule: z.array(z.object({
        milestone: z.string(),
        amount: z.number(),
        due_date: z.string().optional(),
        percentage: z.number().optional(),
    })),
    timeline_weeks: z.number(),
    start_date: z.string(),
    revision_rounds: z.number().default(2),
    jurisdiction: JurisdictionSchema.default('us_general'),
    ip_transfer: z.enum(['full_transfer', 'license_only', 'work_for_hire']).default('full_transfer'),
    confidentiality: z.boolean().default(true),
    include_non_compete: z.boolean().default(false),
    custom_terms: z.array(z.string()).optional(),
});

export type ContractInput = z.infer<typeof ContractInputSchema>;

export interface GeneratedContract {
    contract_id: string;
    type: string;
    generated_at: string;
    status: 'draft' | 'sent' | 'signed' | 'active' | 'completed' | 'cancelled';
    content: string; // Full contract text (Markdown)
    html: string;    // Rendered HTML for display
    pdf_ready: boolean;
    stripe_invoice_id?: string;
    signature_url?: string;
}

// ─── Contract Generator ───────────────────────────────────────────────────────

export async function generateContract(input: ContractInput): Promise<GeneratedContract> {
    const contractId = `contract-${Date.now()}-${input.client_name.toLowerCase().replace(/\s+/g, '-')}`;

    const paymentScheduleText = input.payment_schedule
        .map((p) => `- ${p.milestone}: $${p.amount.toLocaleString()}${p.percentage ? ` (${p.percentage}%)` : ''}${p.due_date ? ` — due ${p.due_date}` : ''}`)
        .join('\n');

    const deliverablesText = input.deliverables.map((d) => `- ${d}`).join('\n');

    const prompt = `You are LEX, the Creative Liberation Engine's legal specialist.

Generate a complete, professional, legally-sound creative services contract.

CONTRACT DETAILS:
- Type: ${input.contract_type}
- Agency: ${input.agency_name} (${input.agency_address})
- Client: ${input.client_name} (${input.client_address})
- Project: ${input.project_title}
- Total Value: $${input.total_value.toLocaleString()}
- Timeline: ${input.timeline_weeks} weeks starting ${input.start_date}
- Jurisdiction: ${input.jurisdiction}
- IP Treatment: ${input.ip_transfer}
- Revision Rounds: ${input.revision_rounds}

SCOPE OF WORK:
${input.scope_of_work}

DELIVERABLES:
${deliverablesText}

PAYMENT SCHEDULE:
${paymentScheduleText}

${input.custom_terms ? `CUSTOM TERMS:\n${input.custom_terms.join('\n')}` : ''}

Generate a complete contract in Markdown with these sections:
1. Agreement Header (parties, date, recitals)
2. Scope of Work
3. Deliverables
4. Timeline & Milestones
5. Fees & Payment Schedule  
6. Revision Policy (${input.revision_rounds} rounds included)
7. Intellectual Property (${input.ip_transfer} treatment)
8. Confidentiality${input.confidentiality ? ' (included)' : ' (N/A)'}
9. Warranties & Representations
10. Limitation of Liability
11. Termination & Cancellation Policy
12. Dispute Resolution (jurisdiction: ${input.jurisdiction})
13. Force Majeure
14. Entire Agreement
15. Signature Block (two parties)

Use professional legal language but keep it readable. Reference ${input.jurisdiction} law where applicable.
Generate a COMPLETE contract, not a template.`;

    const contractMd = await genkitGenerate(prompt, { temperature: 0.2 });

    // Convert markdown to basic HTML
    const html = markdownToContractHTML(contractMd, input.agency_name, input.client_name, input.project_title);

    // Generate PDF from HTML (Callback required due to `@types/html-pdf-node` lacking Promise types)
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        htmlPdf.generatePdf(
            { content: html },
            { format: 'A4', margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' } },
            (err, buffer) => {
                if (err) return reject(err);
                resolve(buffer);
            }
        );
    });

    // Auto-email if client_email is provided
    if (input.client_email) {
        await notifier.send({
            type: 'contract_sent',
            to_email: input.client_email,
            client_name: input.client_name,
            project_title: input.project_title,
            attachments: [{ filename: `${contractId}.pdf`, content: pdfBuffer }]
        }).catch(err => console.warn('[LEX] Failed to email contract:', err.message));
    }

    return {
        contract_id: contractId,
        type: input.contract_type,
        generated_at: new Date().toISOString(),
        status: input.client_email ? 'sent' : 'draft',
        content: contractMd,
        html,
        pdf_ready: true,
    };
}

// ─── Change Order Generator ───────────────────────────────────────────────────

export async function generateChangeOrder(
    originalContractId: string,
    changeDescription: string,
    additionalAmount: number,
    timelineExtensionDays: number,
    agencyName: string,
    clientName: string
): Promise<string> {
    const prompt = `You are LEX, the Creative Liberation Engine's legal specialist.

Generate a professional Change Order amendment for an existing creative services contract.

ORIGINAL CONTRACT: ${originalContractId}
PARTIES: ${agencyName} (Agency) and ${clientName} (Client)
DATE: ${new Date().toLocaleDateString()}

CHANGE DESCRIPTION:
${changeDescription}

FINANCIAL IMPACT: +$${additionalAmount.toLocaleString()} (additional to original contract value)
TIMELINE IMPACT: +${timelineExtensionDays} days to original timeline

Generate a concise, professional Change Order document that:
1. References the original contract
2. Clearly describes what changed and why
3. States the new financial terms
4. States the updated timeline
5. Has signature block for both parties

Keep it to 1 page. Professional but concise.`;

    return await genkitGenerate(prompt, { temperature: 0.2 });
}

// ─── HTML Renderer ────────────────────────────────────────────────────────────

function markdownToContractHTML(md: string, agencyName: string, clientName: string, projectTitle: string): string {
    const escapedMd = md
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^\- (.+)$/gm, '<li>$1</li>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Contract — ${projectTitle}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; line-height: 1.8; }
  h1 { text-align: center; font-size: 1.4rem; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid #000; padding-bottom: 16px; }
  h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: 1px; margin-top: 32px; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
  h3 { font-size: 0.95rem; margin-top: 20px; }
  li { margin: 4px 0; }
  .signature-block { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
  .sig-line { border-top: 1px solid #000; padding-top: 8px; margin-top: 40px; font-size: 0.85rem; }
  .header-meta { text-align: center; color: #666; font-size: 0.85rem; margin-bottom: 32px; }
</style>
</head>
<body>
<div class="header-meta">
  ${agencyName} × ${clientName} &nbsp;|&nbsp; Generated by LEX (Creative Liberation Engine GENESIS)
</div>
<p>${escapedMd}</p>
</body>
</html>`;
}

// ─── Contract Templates (Quick-start) ────────────────────────────────────────
// Pre-filled defaults for common contract types

export const CONTRACT_DEFAULTS: Record<z.infer<typeof ContractTypeSchema>, Partial<ContractInput>> = {
    brand_identity: {
        revision_rounds: 3,
        ip_transfer: 'full_transfer',
        timeline_weeks: 6,
        payment_schedule: [
            { milestone: 'Project Kickoff', amount: 0, percentage: 50 },
            { milestone: 'Final Delivery & Approval', amount: 0, percentage: 50 },
        ],
    },
    digital_product_development: {
        revision_rounds: 2,
        ip_transfer: 'work_for_hire',
        timeline_weeks: 12,
        payment_schedule: [
            { milestone: 'Project Kickoff', amount: 0, percentage: 33 },
            { milestone: 'Design Approval', amount: 0, percentage: 33 },
            { milestone: 'Final Launch', amount: 0, percentage: 34 },
        ],
    },
    retainer: {
        revision_rounds: 10,
        ip_transfer: 'work_for_hire',
        timeline_weeks: 4, // per month
        payment_schedule: [
            { milestone: 'Monthly Payment', amount: 0, percentage: 100 },
        ],
    },
    broadcast_production: {
        revision_rounds: 2,
        ip_transfer: 'license_only',
        timeline_weeks: 4,
        payment_schedule: [
            { milestone: 'Pre-Production Deposit', amount: 0, percentage: 40 },
            { milestone: 'Production Completion', amount: 0, percentage: 40 },
            { milestone: 'Final Delivery', amount: 0, percentage: 20 },
        ],
    },
    campaign_creative: { revision_rounds: 2, ip_transfer: 'full_transfer', timeline_weeks: 4, payment_schedule: [] },
    photography_video: { revision_rounds: 1, ip_transfer: 'license_only', timeline_weeks: 2, payment_schedule: [] },
    social_media_management: { revision_rounds: 5, ip_transfer: 'work_for_hire', timeline_weeks: 4, payment_schedule: [] },
    consulting: { revision_rounds: 0, ip_transfer: 'license_only', timeline_weeks: 1, payment_schedule: [] },
    licensing: { revision_rounds: 0, ip_transfer: 'license_only', timeline_weeks: 1, payment_schedule: [] },
};
