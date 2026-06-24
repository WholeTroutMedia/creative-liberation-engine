import { z } from 'zod';

// ─── ZERO DAY — Business Analytics Aggregator ────────────────────────────────
// Aggregates data from projects, clients, financials, and retainers to produce
// KPI dashboards and trend analysis reports.

export const AnalyticsPeriodSchema = z.object({
    from: z.string().describe('ISO 8601 date (start of period)'),
    to: z.string().describe('ISO 8601 date (end of period)'),
    label: z.string().optional().describe('e.g. "Q1 2026"'),
});

export const RevenueMetricsSchema = z.object({
    period: AnalyticsPeriodSchema,
    invoices: z.array(z.object({
        client_name: z.string(),
        amount: z.number(),
        paid: z.boolean(),
        type: z.enum(['project', 'retainer', 'overage', 'addon']),
        date: z.string(),
    })),
    expenses: z.array(z.object({ description: z.string(), amount: z.number(), category: z.string(), date: z.string() })).optional(),
});

export const ProjectMetricsSchema = z.object({
    period: AnalyticsPeriodSchema,
    projects: z.array(z.object({
        name: z.string(),
        client: z.string(),
        status: z.string(),
        value: z.number().optional(),
        started_at: z.string(),
        completed_at: z.string().optional(),
        deliverables_total: z.number(),
        deliverables_completed: z.number(),
    })),
});

export const ClientMetricsSchema = z.object({
    period: AnalyticsPeriodSchema,
    clients: z.array(z.object({
        id: z.string(),
        name: z.string(),
        tier: z.enum(['standard', 'growth', 'enterprise']).optional(),
        revenue: z.number(),
        project_count: z.number(),
        health_score: z.number().min(0).max(100).optional(),
        churned: z.boolean().default(false),
    })),
});

export const FullDashboardSchema = z.object({
    company_name: z.string().default('Whole Trout Media'),
    period: AnalyticsPeriodSchema,
    revenue_metrics: RevenueMetricsSchema.optional(),
    project_metrics: ProjectMetricsSchema.optional(),
    client_metrics: ClientMetricsSchema.optional(),
    output_format: z.enum(['html', 'json', 'both']).default('both'),
});

// ─── Analytics computations ───────────────────────────────────────────────────

export interface RevenueKpis {
    gross_revenue: number;
    collected_revenue: number;
    outstanding: number;
    collection_rate_pct: number;
    by_type: Record<string, number>;
    net_profit?: number;
    top_client?: string;
}

export function computeRevenueKpis(data: z.infer<typeof RevenueMetricsSchema>): RevenueKpis {
    const gross = data.invoices.reduce((s, i) => s + i.amount, 0);
    const collected = data.invoices.filter(i => i.paid).reduce((s, i) => s + i.amount, 0);
    const outstanding = gross - collected;
    const by_type: Record<string, number> = {};
    for (const inv of data.invoices) by_type[inv.type] = (by_type[inv.type] ?? 0) + inv.amount;
    const expenses = (data.expenses ?? []).reduce((s, e) => s + e.amount, 0);
    const clientTotals: Record<string, number> = {};
    for (const inv of data.invoices) clientTotals[inv.client_name] = (clientTotals[inv.client_name] ?? 0) + inv.amount;
    const topClient = Object.entries(clientTotals).sort(([, a], [, b]) => b - a)[0]?.[0];
    return {
        gross_revenue: Math.round(gross * 100) / 100,
        collected_revenue: Math.round(collected * 100) / 100,
        outstanding: Math.round(outstanding * 100) / 100,
        collection_rate_pct: gross > 0 ? Math.round(collected / gross * 1000) / 10 : 0,
        by_type,
        net_profit: expenses > 0 ? Math.round((collected - expenses) * 100) / 100 : undefined,
        top_client: topClient,
    };
}

export interface ProjectKpis {
    total: number;
    completed: number;
    in_progress: number;
    completion_rate_pct: number;
    avg_deliverable_completion_pct: number;
    total_value: number;
}

export function computeProjectKpis(data: z.infer<typeof ProjectMetricsSchema>): ProjectKpis {
    const p = data.projects;
    const completed = p.filter(pr => pr.status === 'completed' || pr.status === 'delivered').length;
    const inProgress = p.filter(pr => pr.status === 'active' || pr.status === 'in_progress').length;
    const avgDel = p.reduce((s, pr) => s + (pr.deliverables_total > 0 ? pr.deliverables_completed / pr.deliverables_total : 0), 0) / (p.length || 1);
    const totalValue = p.reduce((s, pr) => s + (pr.value ?? 0), 0);
    return { total: p.length, completed, in_progress: inProgress, completion_rate_pct: Math.round(completed / (p.length || 1) * 1000) / 10, avg_deliverable_completion_pct: Math.round(avgDel * 1000) / 10, total_value: totalValue };
}

export interface ClientKpis { total: number; new_this_period: number; churned: number; avg_health: number; avg_revenue: number; top_tier_count: number }

export function computeClientKpis(data: z.infer<typeof ClientMetricsSchema>): ClientKpis {
    const c = data.clients;
    const churned = c.filter(cl => cl.churned).length;
    const healthScores = c.filter(cl => cl.health_score !== undefined).map(cl => cl.health_score!);
    const avgHealth = healthScores.length ? healthScores.reduce((a, b) => a + b, 0) / healthScores.length : 0;
    const avgRev = c.length ? c.reduce((s, cl) => s + cl.revenue, 0) / c.length : 0;
    const topTier = c.filter(cl => cl.tier === 'enterprise' || cl.tier === 'growth').length;
    return { total: c.length, new_this_period: c.length - churned, churned, avg_health: Math.round(avgHealth * 10) / 10, avg_revenue: Math.round(avgRev * 100) / 100, top_tier_count: topTier };
}

// ─── Dashboard HTML ───────────────────────────────────────────────────────────

export function buildDashboardHtml(input: z.infer<typeof FullDashboardSchema>, revenue?: RevenueKpis, projects?: ProjectKpis, clients?: ClientKpis): string {
    const ac = '#b87333';
    const mCard = (value: string, label: string, sub?: string, color?: string) =>
        `<div class="metric"><div class="metric-val" style="${color ? `color:${color}` : ''}">${value}</div><div class="metric-label">${label}</div>${sub ? `<div class="metric-sub">${sub}</div>` : ''}</div>`;

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${input.company_name} — Analytics</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#f5f0e8;padding:40px;margin:0}
h1{font-size:32px;font-weight:800;letter-spacing:-1px;margin:0 0 4px}h2{font-size:16px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${ac};margin:32px 0 16px}
.sub{color:rgba(245,240,232,0.5);font-size:13px;margin-bottom:32px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-bottom:32px}
.metric{background:rgba(255,255,255,0.05);padding:20px;border-radius:8px}.metric-val{font-size:36px;font-weight:800;line-height:1}
.metric-label{font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.5;margin-top:6px}.metric-sub{font-size:12px;color:${ac};margin-top:4px}
.bar-row{display:flex;align-items:center;gap:12px;margin-bottom:8px}.bar-label{font-size:13px;width:120px;opacity:.7}
.bar{height:8px;background:rgba(255,255,255,.1);border-radius:4px;flex:1}.bar-fill{height:8px;border-radius:4px;background:${ac}}
.bar-val{font-size:12px;font-weight:600;width:60px;text-align:right}
</style></head><body>
<h1>${input.company_name}</h1>
<div class="sub">Dashboard &bull; ${input.period.label ?? `${input.period.from} – ${input.period.to}`}</div>
${revenue ? `<h2>Revenue</h2><div class="grid">
${mCard(`$${revenue.gross_revenue.toLocaleString()}`, 'Gross Revenue')}
${mCard(`$${revenue.collected_revenue.toLocaleString()}`, 'Collected', `${revenue.collection_rate_pct}% rate`, '#28a745')}
${mCard(`$${revenue.outstanding.toLocaleString()}`, 'Outstanding', undefined, revenue.outstanding > 0 ? '#ffc107' : undefined)}
${revenue.net_profit !== undefined ? mCard(`$${revenue.net_profit.toLocaleString()}`, 'Net Profit') : ''}
${revenue.top_client ? mCard(revenue.top_client, 'Top Client') : ''}
</div>
<div>${Object.entries(revenue.by_type).map(([type, amount]) => `<div class="bar-row"><div class="bar-label">${type}</div><div class="bar"><div class="bar-fill" style="width:${Math.round(amount / revenue.gross_revenue * 100)}%"></div></div><div class="bar-val">$${Math.round(amount / 1000)}k</div></div>`).join('')}</div>` : ''}
${projects ? `<h2>Projects</h2><div class="grid">
${mCard(String(projects.total), 'Total Projects')}
${mCard(String(projects.completed), 'Completed', `${projects.completion_rate_pct}%`, '#28a745')}
${mCard(String(projects.in_progress), 'In Progress', undefined, '#ffc107')}
${mCard(`${projects.avg_deliverable_completion_pct}%`, 'Avg Deliverable %')}
</div>` : ''}
${clients ? `<h2>Clients</h2><div class="grid">
${mCard(String(clients.total), 'Total Clients')}
${mCard(String(clients.churned), 'Churned', undefined, clients.churned > 0 ? '#dc3545' : undefined)}
${mCard(`${clients.avg_health}/100`, 'Avg Health Score', undefined, clients.avg_health >= 80 ? '#28a745' : '#ffc107')}
${mCard(`$${Math.round(clients.avg_revenue).toLocaleString()}`, 'Avg Revenue/Client')}
</div>` : ''}
</body></html>`;
}

export async function generateDashboard(input: z.infer<typeof FullDashboardSchema>) {
    const v = FullDashboardSchema.parse(input);
    const revenue = v.revenue_metrics ? computeRevenueKpis(v.revenue_metrics) : undefined;
    const projects = v.project_metrics ? computeProjectKpis(v.project_metrics) : undefined;
    const clients = v.client_metrics ? computeClientKpis(v.client_metrics) : undefined;
    const html = (v.output_format === 'html' || v.output_format === 'both') ? buildDashboardHtml(v, revenue, projects, clients) : undefined;
    return { kpis: { revenue, projects, clients }, html, period: v.period.label ?? `${v.period.from} – ${v.period.to}`, generated_at: new Date().toISOString() };
}

export const ANALYTICS_TOOLS = [
    { name: 'zeroday_compute_revenue_kpis', description: 'Compute revenue KPIs from invoice data: gross, collected, outstanding, by-type breakdown.', inputSchema: RevenueMetricsSchema, handler: computeRevenueKpis, agentPermissions: ['ORACLE', 'ZERO_DAY'], estimatedCost: 'Free' },
    { name: 'zeroday_compute_project_kpis', description: 'Compute project KPIs: completion rate, deliverable %, total value.', inputSchema: ProjectMetricsSchema, handler: computeProjectKpis, agentPermissions: ['ORACLE', 'ZERO_DAY'], estimatedCost: 'Free' },
    { name: 'zeroday_generate_dashboard', description: 'Generate a full revenue + project + client KPI dashboard (HTML + JSON).', inputSchema: FullDashboardSchema, handler: generateDashboard, agentPermissions: ['ORACLE', 'ZERO_DAY'], estimatedCost: 'Free' },
];
