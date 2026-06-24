import { z } from 'zod';
import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || '';
const redis = redisUrl
    ? new Redis(redisUrl, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1 })
    : null;
if (redis) {
    redis.on('error', (err: Error) => console.warn('[ZERO DAY 💰] Redis error (non-fatal):', err.message));
    redis.connect().catch(() => {/* intentional no-op */});
}

// ─── ZERO DAY — Profitability Monitor ────────────────────────────────────────
// WARREN_BUFFETT and MATH agents' real-time margin intelligence.
// Every dollar tracked. Every hour priced.

export const TimeEntrySchema = z.object({
    id: z.string(),
    project_id: z.string(),
    logged_by: z.string().describe('Agent or person name'),
    task: z.string(),
    hours: z.number().positive(),
    hourly_rate: z.number().positive(),
    cost: z.number(),
    logged_at: z.string(),
    billable: z.boolean().default(true),
    category: z.enum(['strategy', 'design', 'development', 'production', 'project_management', 'revision', 'other']),
});

export const ExpenseSchema = z.object({
    id: z.string(),
    project_id: z.string(),
    description: z.string(),
    amount: z.number().positive(),
    category: z.enum(['software', 'ai_api', 'contractor', 'production', 'travel', 'other']),
    logged_at: z.string(),
    billable: z.boolean().default(false),
    receipt_url: z.string().optional(),
});

export const ProfitabilityReportSchema = z.object({
    project_id: z.string(),
    contract_value: z.number(),
    revenue_recognized: z.number(),
    total_hours: z.number(),
    billable_hours: z.number(),
    labor_cost: z.number(),
    expense_cost: z.number(),
    ai_cost_estimate: z.number(),
    total_cost: z.number(),
    gross_profit: z.number(),
    gross_margin_pct: z.number(),
    hours_remaining_budget: z.number().describe('Hours you can still work before going underwater'),
    effective_hourly_rate: z.number().describe('Revenue per hour actually worked'),
    health_status: z.enum(['profitable', 'tight', 'at_risk', 'underwater']),
    alerts: z.array(z.string()),
    by_category: z.record(z.object({ hours: z.number(), cost: z.number() })),
    generated_at: z.string(),
});

export type TimeEntry = z.infer<typeof TimeEntrySchema>;
export type Expense = z.infer<typeof ExpenseSchema>;
export type ProfitabilityReport = z.infer<typeof ProfitabilityReportSchema>;

// ─────────────────────────────────────────────────────────────────────────────

interface ProjectFinancials {
    contract_value: number;
    revenue_recognized: number;
    target_margin: number; // 0-1, e.g. 0.6 = 60% margin target
    time_entries: TimeEntry[];
    expenses: Expense[];
}

export class ProfitabilityMonitor {
    private projects = new Map<string, ProjectFinancials>();

    // Default rates per role/category
    private readonly HOURLY_RATES: Record<string, number> = {
        strategy: 250,
        design: 175,
        development: 200,
        production: 150,
        project_management: 125,
        revision: 175,
        other: 150,
    };

    private readonly AI_COST_PER_HOUR = 0.50; // rough estimate

    constructor() {
        this.hydrateFromRedis();
    }

    private async hydrateFromRedis() {
        if (!redis) return;
        try {
            const keys = await redis.keys('zeroday:profitability:*');
            let count = 0;
            for (const key of keys) {
                const data = await redis.get(key);
                if (data) {
                    const projectId = key.replace('zeroday:profitability:', '');
                    this.projects.set(projectId, JSON.parse(data));
                    count++;
                }
            }
            console.log(`[ZERO DAY 💰] ProfitabilityMonitor hydrated ${count} projects from Redis`);
        } catch (err: any) {
            console.warn('[ZERO DAY 💰] Failed to hydrate from Redis:', err.message);
        }
    }

    private persist(projectId: string) {
        if (!redis) return;
        const stats = this.projects.get(projectId);
        if (stats) {
            redis.set(`zeroday:profitability:${projectId}`, JSON.stringify(stats)).catch(err => {
                console.warn(`[ZERO DAY] Profitability persist failed:`, err.message);
            });
        }
    }

    initProject(projectId: string, contractValue: number, targetMargin = 0.60): void {
        this.projects.set(projectId, {
            contract_value: contractValue,
            revenue_recognized: 0,
            target_margin: targetMargin,
            time_entries: [],
            expenses: [],
        });
        this.persist(projectId);
    }

    logTime(projectId: string, input: {
        logged_by: string;
        task: string;
        hours: number;
        category?: string;
        hourly_rate?: number;
        billable?: boolean;
    }): TimeEntry {
        let financials = this.projects.get(projectId);
        if (!financials) {
            // Auto-init if not tracked
            this.initProject(projectId, 0);
            financials = this.projects.get(projectId)!;
        }

        const category = (input.category ?? 'other') as TimeEntry['category'];
        const hourlyRate = input.hourly_rate ?? this.HOURLY_RATES[category] ?? 150;

        const entry = TimeEntrySchema.parse({
            id: `te-${Date.now()}`,
            project_id: projectId,
            logged_by: input.logged_by,
            task: input.task,
            hours: input.hours,
            hourly_rate: hourlyRate,
            cost: input.hours * hourlyRate,
            logged_at: new Date().toISOString(),
            billable: input.billable ?? true,
            category,
        });

        financials.time_entries.push(entry);
        console.log(`[ZERO DAY 💰] Time logged: ${input.hours}h @${hourlyRate}/hr = $${entry.cost} — ${input.task}`);

        // Alert if going over budget
        const report = this.getReport(projectId);
        if (report.health_status === 'underwater') {
            console.warn(`[ZERO DAY ⚠️] Project ${projectId} is UNDERWATER — margin gap: $${Math.abs(report.gross_profit).toFixed(0)}`);
        }
        
        this.persist(projectId);
        return entry;
    }

    logExpense(projectId: string, input: {
        description: string;
        amount: number;
        category: Expense['category'];
        billable?: boolean;
        receipt_url?: string;
    }): Expense {
        let financials = this.projects.get(projectId);
        if (!financials) {
            this.initProject(projectId, 0);
            financials = this.projects.get(projectId)!;
        }

        const expense = ExpenseSchema.parse({
            id: `exp-${Date.now()}`,
            project_id: projectId,
            ...input,
            logged_at: new Date().toISOString(),
        });

        financials.expenses.push(expense);
        this.persist(projectId);
        return expense;
    }

    recognizeRevenue(projectId: string, amount: number): void {
        const financials = this.projects.get(projectId);
        if (financials) {
            financials.revenue_recognized += amount;
            this.persist(projectId);
        }
    }

    getReport(projectId: string): ProfitabilityReport {
        const financials = this.projects.get(projectId);
        if (!financials) throw new Error(`Project ${projectId} not tracked in profitability monitor`);

        const totalHours = financials.time_entries.reduce((sum, e) => sum + e.hours, 0);
        const billableHours = financials.time_entries.filter((e) => e.billable).reduce((sum, e) => sum + e.hours, 0);
        const laborCost = financials.time_entries.reduce((sum, e) => sum + e.cost, 0);
        const expenseCost = financials.expenses.reduce((sum, e) => sum + e.amount, 0);
        const aiCostEstimate = totalHours * this.AI_COST_PER_HOUR;
        const totalCost = laborCost + expenseCost + aiCostEstimate;

        const revenue = financials.revenue_recognized || financials.contract_value;
        const grossProfit = revenue - totalCost;
        const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

        // Budget remaining calculation
        const targetCostCeiling = revenue * (1 - financials.target_margin);
        const costBudgetRemaining = targetCostCeiling - totalCost;
        const avgHourlyRate = totalHours > 0 ? laborCost / totalHours : 150;
        const hoursRemainingBudget = costBudgetRemaining > 0 ? costBudgetRemaining / avgHourlyRate : 0;

        const effectiveHourlyRate = totalHours > 0 ? revenue / totalHours : 0;

        // Health status
        let healthStatus: ProfitabilityReport['health_status'];
        if (grossMarginPct >= (financials.target_margin * 100 * 0.8)) healthStatus = 'profitable';
        else if (grossMarginPct >= (financials.target_margin * 100 * 0.5)) healthStatus = 'tight';
        else if (grossMarginPct >= 0) healthStatus = 'at_risk';
        else healthStatus = 'underwater';

        // Alerts
        const alerts: string[] = [];
        if (healthStatus === 'underwater') alerts.push(`🚨 Project is underwater — losing $${Math.abs(grossProfit).toFixed(0)}`);
        if (healthStatus === 'at_risk') alerts.push(`⚠️ Margin dropping — only ${grossMarginPct.toFixed(1)}% left (target: ${(financials.target_margin * 100).toFixed(0)}%)`);
        if (hoursRemainingBudget < 4) alerts.push(`⏱️ Only ${hoursRemainingBudget.toFixed(1)}h of budget remaining before going unprofitable`);
        if (effectiveHourlyRate < 100) alerts.push(`💸 Effective hourly rate dropped below $100/hr ($${effectiveHourlyRate.toFixed(0)}/hr)`);

        // By category breakdown
        const byCategory: Record<string, { hours: number; cost: number }> = {};
        for (const entry of financials.time_entries) {
            if (!byCategory[entry.category]) byCategory[entry.category] = { hours: 0, cost: 0 };
            byCategory[entry.category].hours += entry.hours;
            byCategory[entry.category].cost += entry.cost;
        }

        return ProfitabilityReportSchema.parse({
            project_id: projectId,
            contract_value: financials.contract_value,
            revenue_recognized: financials.revenue_recognized,
            total_hours: totalHours,
            billable_hours: billableHours,
            labor_cost: laborCost,
            expense_cost: expenseCost,
            ai_cost_estimate: aiCostEstimate,
            total_cost: totalCost,
            gross_profit: grossProfit,
            gross_margin_pct: Math.round(grossMarginPct * 10) / 10,
            hours_remaining_budget: Math.max(0, hoursRemainingBudget),
            effective_hourly_rate: Math.round(effectiveHourlyRate),
            health_status: healthStatus,
            alerts,
            by_category: byCategory,
            generated_at: new Date().toISOString(),
        });
    }

    getStudioSummary() {
        const allReports = Array.from(this.projects.keys()).map((id) => {
            try { return this.getReport(id); } catch { return null; }
        }).filter(Boolean) as ProfitabilityReport[];

        const totalRevenue = allReports.reduce((sum, r) => sum + r.contract_value, 0);
        const totalCost = allReports.reduce((sum, r) => sum + r.total_cost, 0);
        const totalProfit = totalRevenue - totalCost;
        const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        const underWater = allReports.filter((r) => r.health_status === 'underwater');

        return {
            studio_revenue_pipeline: totalRevenue,
            studio_total_cost: totalCost,
            studio_gross_profit: totalProfit,
            studio_avg_margin_pct: Math.round(avgMargin * 10) / 10,
            total_projects_tracked: allReports.length,
            underwater_count: underWater.length,
            underwater_projects: underWater.map((r) => r.project_id),
            generated_at: new Date().toISOString(),
        };
    }
}
