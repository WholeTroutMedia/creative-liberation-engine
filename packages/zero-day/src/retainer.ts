import { z } from 'zod';

// ─── ZERO DAY — Retainer Engine ───────────────────────────────────────────────
// Manages monthly/quarterly retainer agreements: contract terms, usage tracking,
// billing cycles, overage calculation, and renewal reminder generation.

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const RetainerPlanSchema = z.object({
    plan_id: z.string(),
    client_id: z.string(),
    client_name: z.string(),
    client_email: z.string().email(),
    plan_name: z.string().describe('e.g. "Growth Retainer", "Brand Maintenance"'),
    monthly_rate: z.number().describe('Monthly fee in USD'),
    included_hours: z.number().describe('Hours included per cycle'),
    overage_rate: z.number().describe('Hourly overage rate in USD'),
    cycle: z.enum(['monthly', 'quarterly', 'annual']).default('monthly'),
    services: z.array(z.string()).describe('Covered services, e.g. ["Social Media", "Video Editing"]'),
    start_date: z.string().describe('ISO 8601 date, e.g. "2026-03-01"'),
    auto_renew: z.boolean().default(true),
    payment_day: z.number().min(1).max(28).default(1).describe('Day of month when invoice is generated'),
    notes: z.string().optional(),
});

export const UsageRecordSchema = z.object({
    plan_id: z.string(),
    cycle_label: z.string().describe('e.g. "2026-03" or "Q1 2026"'),
    entries: z.array(z.object({
        date: z.string().describe('ISO 8601'),
        service: z.string(),
        hours: z.number().min(0),
        description: z.string().optional(),
        team_member: z.string().optional(),
    })),
});

export const RetainerInvoiceSchema = z.object({
    plan_id: z.string(),
    cycle_label: z.string(),
    retainer: RetainerPlanSchema,
    usage: UsageRecordSchema,
    additional_line_items: z.array(z.object({
        description: z.string(),
        amount: z.number(),
    })).optional(),
});

// ─── Usage analytics ──────────────────────────────────────────────────────────

export interface UsageSummary {
    cycle_label: string;
    total_hours: number;
    included_hours: number;
    overage_hours: number;
    overage_amount: number;
    utilisation_pct: number;
    breakdown: Record<string, number>;
    status: 'under' | 'on-track' | 'over';
}

export function analyseUsage(plan: z.infer<typeof RetainerPlanSchema>, usage: z.infer<typeof UsageRecordSchema>): UsageSummary {
    const total = usage.entries.reduce((s, e) => s + e.hours, 0);
    const overage = Math.max(0, total - plan.included_hours);
    const breakdown: Record<string, number> = {};
    for (const e of usage.entries) {
        breakdown[e.service] = (breakdown[e.service] ?? 0) + e.hours;
    }
    const pct = Math.round((total / plan.included_hours) * 100);
    return {
        cycle_label: usage.cycle_label,
        total_hours: Math.round(total * 100) / 100,
        included_hours: plan.included_hours,
        overage_hours: Math.round(overage * 100) / 100,
        overage_amount: Math.round(overage * plan.overage_rate * 100) / 100,
        utilisation_pct: pct,
        breakdown,
        status: pct < 50 ? 'under' : pct <= 110 ? 'on-track' : 'over',
    };
}

// ─── Invoice generator ────────────────────────────────────────────────────────

export function generateRetainerInvoice(input: z.infer<typeof RetainerInvoiceSchema>): {
    invoice_html: string;
    invoice_markdown: string;
    line_items: Array<{ description: string; amount: number }>;
    total: number;
    overage_hours: number;
} {
    const v = RetainerInvoiceSchema.parse(input);
    const usage = analyseUsage(v.retainer, v.usage);

    const lineItems: Array<{ description: string; amount: number }> = [
        { description: `${v.retainer.plan_name} — ${v.cycle_label}`, amount: v.retainer.monthly_rate },
    ];

    if (usage.overage_hours > 0) {
        lineItems.push({
            description: `Overage: ${usage.overage_hours}h × $${v.retainer.overage_rate}/h`,
            amount: usage.overage_amount,
        });
    }

    for (const item of v.additional_line_items ?? []) {
        lineItems.push(item);
    }

    const total = lineItems.reduce((s, l) => s + l.amount, 0);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    const dueDateStr = dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Markdown invoice
    const md = [
        `# Invoice — ${v.retainer.plan_name}`,
        `**Client:** ${v.retainer.client_name}`,
        `**Period:** ${v.cycle_label}`,
        `**Due:** ${dueDateStr}`,
        '',
        '## Services',
        ...v.usage.entries.slice(0, 10).map(e => `- ${e.date} | ${e.service} | ${e.hours}h${e.description ? ` — ${e.description}` : ''}`),
        '',
        '## Summary',
        `- Hours included: ${v.retainer.included_hours}`,
        `- Hours used: ${usage.total_hours} (${usage.utilisation_pct}%)`,
        usage.overage_hours > 0 ? `- **Overage: ${usage.overage_hours}h ($${usage.overage_amount})** ⚠️` : `- No overage`,
        '',
        '## Invoice',
        ...lineItems.map(l => `| ${l.description} | $${l.amount.toLocaleString()} |`),
        `| **Total** | **$${total.toLocaleString()}** |`,
    ].join('\n');

    // HTML invoice
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Invoice — ${v.retainer.plan_name}</title>
<style>
  body{font-family:-apple-system,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1a1a}
  .header{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:24px;border-bottom:3px solid #b87333;margin-bottom:32px}
  .brand{font-size:28px;font-weight:800;letter-spacing:-1px}
  .invoice-meta{text-align:right;font-size:13px;color:#666}
  .client-section{margin-bottom:32px}
  .section-label{font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#b87333;margin-bottom:8px}
  .usage-bar{height:8px;background:#f0f0f0;border-radius:4px;margin:8px 0}
  .usage-fill{height:8px;border-radius:4px;background:${usage.status === 'over' ? '#dc3545' : usage.status === 'under' ? '#6c757d' : '#28a745'}}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{text-align:left;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;padding:10px 0;border-bottom:2px solid #f0f0f0}
  td{padding:12px 0;border-bottom:1px solid #f5f5f5;font-size:14px}
  td:last-child{text-align:right;font-weight:600}
  .total-row td{font-size:20px;font-weight:800;border-bottom:none;padding-top:20px;color:#0a0a0f}
  .badge{display:inline-block;padding:4px 12px;border-radius:100px;font-size:11px;font-weight:700}
  .badge-over{background:#f8d7da;color:#721c24}
  .badge-on{background:#d4edda;color:#155724}
  .badge-under{background:#e2e3e5;color:#383d41}
</style></head><body>
  <div class="header">
    <div><div class="brand">ZERO DAY</div><div style="font-size:13px;color:#666;margin-top:4px">Client Invoice</div></div>
    <div class="invoice-meta"><strong>${v.cycle_label}</strong><br>Due: ${dueDateStr}</div>
  </div>
  <div class="client-section">
    <div class="section-label">Billed To</div>
    <div style="font-size:18px;font-weight:700">${v.retainer.client_name}</div>
    <div style="color:#666">${v.retainer.client_email}</div>
    <div style="margin-top:8px">
      <span class="badge badge-${usage.status === 'over' ? 'over' : usage.status === 'under' ? 'under' : 'on'}">${usage.utilisation_pct}% utilised — ${usage.status}</span>
    </div>
    <div class="usage-bar"><div class="usage-fill" style="width:${Math.min(100, usage.utilisation_pct)}%"></div></div>
    <div style="font-size:13px;color:#666">${usage.total_hours}h used of ${v.retainer.included_hours}h included</div>
  </div>
  <table>
    <thead><tr><th>Description</th><th>Amount</th></tr></thead>
    <tbody>
      ${lineItems.map(l => `<tr><td>${l.description}</td><td>$${l.amount.toLocaleString()}</td></tr>`).join('')}
      <tr class="total-row"><td>Total Due</td><td>$${total.toLocaleString()}</td></tr>
    </tbody>
  </table>
  <div style="font-size:12px;color:#999;border-top:1px solid #f0f0f0;padding-top:16px">
    ${v.retainer.services.map(s => `<span style="display:inline-block;background:#f5f5f5;padding:3px 10px;border-radius:100px;margin:3px;font-size:11px">${s}</span>`).join('')}
  </div>
</body></html>`;

    return { invoice_html: html, invoice_markdown: md, line_items: lineItems, total, overage_hours: usage.overage_hours };
}

// ─── Renewal reminder generator ───────────────────────────────────────────────

export function generateRenewalReminder(plan: z.infer<typeof RetainerPlanSchema>, daysUntilRenewal: number): string {
    const sense = daysUntilRenewal <= 7 ? 'URGENT: ' : '';
    return `Subject: ${sense}Your ${plan.plan_name} renews in ${daysUntilRenewal} day${daysUntilRenewal !== 1 ? 's' : ''}

Hi ${plan.client_name},

Your ${plan.plan_name} retainer renews on ${new Date(Date.now() + daysUntilRenewal * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.

**Plan details:**
- Monthly rate: $${plan.monthly_rate.toLocaleString()}
- Included hours: ${plan.included_hours}h/month
- Services: ${plan.services.join(', ')}
${plan.auto_renew ? '\nYour plan will auto-renew. No action needed.' : '\nPlease reply to confirm renewal or let us know if you would like to make any changes.'}

Have questions? Reply to this email anytime.

— The ZERO DAY Team`;
}

// ─── MCP Tools ────────────────────────────────────────────────────────────────

export const RETAINER_TOOLS = [
    {
        name: 'zeroday_analyse_usage',
        description: 'Analyse retainer usage for a billing cycle: hours used, overage, utilisation %, service breakdown.',
        inputSchema: z.object({ plan: RetainerPlanSchema, usage: UsageRecordSchema }),
        handler: ({ plan, usage }: { plan: z.infer<typeof RetainerPlanSchema>; usage: z.infer<typeof UsageRecordSchema> }) => analyseUsage(plan, usage),
        agentPermissions: ['ORACLE', 'ZERO_DAY'],
        estimatedCost: 'Free',
    },
    {
        name: 'zeroday_generate_retainer_invoice',
        description: 'Generate a retainer invoice with overage calculation and usage summary in HTML and Markdown.',
        inputSchema: RetainerInvoiceSchema,
        handler: generateRetainerInvoice,
        agentPermissions: ['ORACLE', 'ZERO_DAY'],
        estimatedCost: 'Free',
    },
    {
        name: 'zeroday_generate_renewal_reminder',
        description: 'Generate a renewal reminder email for a retainer client.',
        inputSchema: z.object({ plan: RetainerPlanSchema, days_until_renewal: z.number().min(0) }),
        handler: ({ plan, days_until_renewal }: { plan: z.infer<typeof RetainerPlanSchema>; days_until_renewal: number }) =>
            ({ email_text: generateRenewalReminder(plan, days_until_renewal) }),
        agentPermissions: ['ORACLE', 'ZERO_DAY'],
        estimatedCost: 'Free',
    },
];
