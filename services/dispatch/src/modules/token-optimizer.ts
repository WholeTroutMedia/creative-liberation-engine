/**
 * Token Optimizer Module — Helix γ
 * Extension for dispatch service.
 * Smart context management, token budgeting, waste elimination.
 */
import { randomUUID as uuidv4 } from 'crypto';

export interface TokenBudget {
  budget_id: string;
  agent_id: string;
  max_tokens: number;
  used_tokens: number;
  cached_tokens: number;
  waste_tokens: number;
  efficiency_percent: number;
  window_start: string;
  strategies_applied: string[];
}

export interface OptimizationResult {
  original_tokens: number;
  optimized_tokens: number;
  savings_percent: number;
  strategies: { name: string; tokens_saved: number }[];
}

const budgets = new Map<string, TokenBudget>();

export function createBudget(agentId: string, maxTokens: number): TokenBudget {
  const budget: TokenBudget = {
    budget_id: uuidv4(), agent_id: agentId, max_tokens: maxTokens,
    used_tokens: 0, cached_tokens: 0, waste_tokens: 0, efficiency_percent: 100,
    window_start: new Date().toISOString(), strategies_applied: [],
  };
  budgets.set(budget.budget_id, budget);
  return budget;
}

export function optimizeContext(text: string, maxTokens: number): OptimizationResult {
  const originalTokens = Math.ceil(text.length / 4);
  const strategies: { name: string; tokens_saved: number }[] = [];
  let current = text;

  // Strategy 1: Remove redundant whitespace
  const ws = current.replace(/\n{3,}/g, '\n\n').replace(/  +/g, ' ');
  const wsSaved = Math.ceil((current.length - ws.length) / 4);
  if (wsSaved > 0) { strategies.push({ name: 'whitespace_compression', tokens_saved: wsSaved }); current = ws; }

  // Strategy 2: Remove comments (for code)
  const noComments = current.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const commentSaved = Math.ceil((current.length - noComments.length) / 4);
  if (commentSaved > 10) { strategies.push({ name: 'comment_removal', tokens_saved: commentSaved }); current = noComments; }

  // Strategy 3: Truncate if still over budget
  const optimizedTokens = Math.ceil(current.length / 4);
  if (optimizedTokens > maxTokens) {
    const truncSaved = optimizedTokens - maxTokens;
    strategies.push({ name: 'truncation', tokens_saved: truncSaved });
  }

  const totalSaved = strategies.reduce((s, st) => s + st.tokens_saved, 0);
  return {
    original_tokens: originalTokens,
    optimized_tokens: Math.max(originalTokens - totalSaved, 0),
    savings_percent: originalTokens > 0 ? Math.round((totalSaved / originalTokens) * 100) : 0,
    strategies,
  };
}

export function recordUsage(budgetId: string, tokens: number, cached: number, waste: number): void {
  const b = budgets.get(budgetId);
  if (!b) return;
  b.used_tokens += tokens;
  b.cached_tokens += cached;
  b.waste_tokens += waste;
  b.efficiency_percent = b.used_tokens > 0 ? Math.round(((b.used_tokens - b.waste_tokens) / b.used_tokens) * 100) : 100;
}

export function getBudget(budgetId: string) { return budgets.get(budgetId); }
export function getAllBudgets() { return Array.from(budgets.values()); }
