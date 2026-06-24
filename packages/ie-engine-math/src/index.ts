/**
 * IE Engine Math — Symbolic Computation & Analytics Layer
 *
 * Powers financial modeling, statistical reasoning, telemetry
 * calculations, and formula evaluation across the Creative Liberation Engine.
 *
 * Design: pure TypeScript, zero runtime dependencies.
 * All calculations are deterministic and fully typed.
 */

// ─── Statistical Functions ────────────────────────────────────

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)]!;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

// ─── Financial Calculations ───────────────────────────────────

export interface RevenueProjection {
  monthly: number;
  quarterly: number;
  annual: number;
  cagr: number;
}

/**
 * Project revenue from a base MRR with a monthly growth rate.
 */
export function projectRevenue(baseMrr: number, monthlyGrowthRate: number, months: number = 12): RevenueProjection {
  const monthlyValues: number[] = [];
  let current = baseMrr;
  for (let i = 0; i < months; i++) {
    monthlyValues.push(current);
    current *= (1 + monthlyGrowthRate);
  }
  const annual = sum(monthlyValues);
  const cagr = Math.pow(monthlyValues[monthlyValues.length - 1]! / baseMrr, 12 / months) - 1;

  return {
    monthly: monthlyValues[monthlyValues.length - 1]!,
    quarterly: sum(monthlyValues.slice(-3)),
    annual,
    cagr,
  };
}

/**
 * Calculate Customer Acquisition Cost and LTV ratio.
 */
export function cltv(avgRevenuePerUser: number, churnRate: number, grossMargin: number = 0.8): number {
  if (churnRate <= 0) return Infinity;
  return (avgRevenuePerUser * grossMargin) / churnRate;
}

export function cacLtvRatio(cac: number, ltv: number): number {
  return ltv / cac;
}

// ─── Telemetry Math ───────────────────────────────────────────

export interface P99Report {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  mean: number;
  max: number;
}

export function latencyReport(durationsMs: number[]): P99Report {
  return {
    p50: percentile(durationsMs, 50),
    p90: percentile(durationsMs, 90),
    p95: percentile(durationsMs, 95),
    p99: percentile(durationsMs, 99),
    mean: mean(durationsMs),
    max: Math.max(...durationsMs),
  };
}

// ─── Formula Evaluator ────────────────────────────────────────

type FormulaVariables = Record<string, number>;

/**
 * Evaluate a simple arithmetic formula string with named variables.
 * Supports: +, -, *, /, ^, parentheses, named variables.
 *
 * SAFE: no eval(). Uses a recursive descent parser.
 */
export function evaluate(formula: string, vars: FormulaVariables = {}): number {
  let pos = 0;
  const expr = formula.replace(/\s+/g, '');

  function peek(): string { return expr[pos] ?? ''; }
  function consume(): string { return expr[pos++] ?? ''; }
  function parseNumber(): number {
    let num = '';
    while (/[\d.]/.test(peek())) num += consume();
    return parseFloat(num);
  }
  function parseIdent(): number {
    let id = '';
    while (/[a-zA-Z_]/.test(peek())) id += consume();
    if (id in vars) return vars[id]!;
    throw new Error(`[ie-math] Unknown variable: ${id}`);
  }
  function parsePrimary(): number {
    if (peek() === '(') { consume(); const v = parseExpr(); consume(); return v; }
    if (/[a-zA-Z_]/.test(peek())) return parseIdent();
    return parseNumber();
  }
  function parsePow(): number {
    let base = parsePrimary();
    if (peek() === '^') { consume(); base = Math.pow(base, parsePow()); }
    return base;
  }
  function parseTerm(): number {
    let left = parsePow();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parsePow();
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }
  function parseExpr(): number {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  return parseExpr();
}

// ─── Unit Conversion ──────────────────────────────────────────

export const convert = {
  bytesToMB: (b: number) => b / (1024 * 1024),
  bytesToGB: (b: number) => b / (1024 * 1024 * 1024),
  msToSeconds: (ms: number) => ms / 1000,
  secondsToMs: (s: number) => s * 1000,
  usdToCents: (usd: number) => Math.round(usd * 100),
  centsToUSD: (cents: number) => cents / 100,
  tokensToEstimatedCost: (tokens: number, pricePerMillion: number) => (tokens / 1_000_000) * pricePerMillion,
};
