#!/usr/bin/env node
/**
 * CODEX-DELTA — Pattern Extractor
 *
 * Phase 2 of Ouroboros: mines the codebase for structural repetition
 * and identifies candidates for DSL compression.
 *
 * Patterns detected:
 *   - Repeated Genkit flow definitions (same defineFlow() signature shape)
 *   - Repeated agent hive registrations
 *   - Repeated dispatch task schema structures
 *
 * Usage: npx tsx src/index.ts [analyze|report]
 * Output: dsl-candidates.md at the repo root
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────

interface PatternMatch {
  pattern: string;
  count: number;
  files: string[];
  example: string;
  dslCandidate: string;
}

interface CodexReport {
  generatedAt: string;
  repoRoot: string;
  totalFilesScanned: number;
  patterns: PatternMatch[];
}

// ─── Pattern Definitions ─────────────────────────────────

const PATTERNS: Array<{ name: string; regex: RegExp; dslTemplate: string }> = [
  {
    name: 'Genkit defineFlow',
    regex: /ai\.defineFlow\s*\(\s*\{[^}]*name:\s*['"`](\w+)['"`][^}]*\}/g,
    dslTemplate: '@flow {name}({input}) -> {output}\n  uses: $MODEL\n  cache: $CACHE',
  },
  {
    name: 'Genkit definePrompt',
    regex: /ai\.definePrompt\s*\(\s*\{[^}]*name:\s*['"`](\w+)['"`][^}]*\}/g,
    dslTemplate: '@prompt {name}\n  model: $MODEL\n  template: {templateRef}',
  },
  {
    name: 'Agent hive registration',
    regex: /registerAgent\s*\(\s*\{[^}]*id:\s*['"`](\w+)['"`][^}]*\}/g,
    dslTemplate: '@agent {id}\n  hive: {hive}\n  role: {role}',
  },
  {
    name: 'Express route handler',
    regex: /app\.(get|post|put|delete)\s*\(\s*['"`]([^'"` ]+)['"`]/g,
    dslTemplate: '@route {method} {path} -> {handler}',
  },
  {
    name: 'Dispatch task schema',
    regex: /z\.object\s*\(\s*\{[^}]*workstream:\s*z\.string/g,
    dslTemplate: '@task-schema {name}\n  workstream: string\n  priority: {priority}',
  },
];

// ─── Scanner ─────────────────────────────────────────────

function scanFiles(dir: string, exts: string[] = ['.ts', '.tsx']): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanFiles(full, exts));
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

async function analyzePatterns(repoRoot: string): Promise<CodexReport> {
  const dirs = ['packages/genkit/src', 'packages/dispatch/src', 'packages/memory/src'];
  const allFiles: string[] = [];

  for (const dir of dirs) {
    allFiles.push(...scanFiles(path.join(repoRoot, dir)));
  }

  const patternCounts = new Map<string, PatternMatch>();

  for (const file of allFiles) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const { name, regex, dslTemplate } of PATTERNS) {
      const matches = [...content.matchAll(regex)];
      if (matches.length === 0) continue;

      const existing = patternCounts.get(name) ?? {
        pattern: name,
        count: 0,
        files: [],
        example: matches[0][0].slice(0, 120).replace(/\s+/g, ' '),
        dslCandidate: dslTemplate,
      };

      existing.count += matches.length;
      if (!existing.files.includes(path.relative(repoRoot, file))) {
        existing.files.push(path.relative(repoRoot, file));
      }

      patternCounts.set(name, existing);
    }
  }

  const patterns = [...patternCounts.values()]
    .filter(p => p.count >= 3)
    .sort((a, b) => b.count - a.count);

  return {
    generatedAt: new Date().toISOString(),
    repoRoot,
    totalFilesScanned: allFiles.length,
    patterns,
  };
}

// ─── Report Builder ───────────────────────────────────────

function buildReport(report: CodexReport): string {
  const lines = [
    `# CODEX-DELTA DSL Candidates Report`,
    ``,
    `> Generated: ${report.generatedAt}`,
    `> Files Scanned: ${report.totalFilesScanned}`,
    ``,
    `---`,
    ``,
    `## Summary`,
    ``,
    `${report.patterns.length} structural pattern(s) detected with ≥3 occurrences — candidates for DSL compression.`,
    ``,
    `| Pattern | Occurrences | Files | Compression Ratio (est.) |`,
    `|---------|-------------|-------|--------------------------|`,
    ...report.patterns.map(p => {
      const ratio = Math.round((1 - (p.dslCandidate.length / (p.example.length || 1))) * 100);
      return `| ${p.pattern} | **${p.count}** | ${p.files.length} | ~${Math.max(ratio, 0)}% smaller |`;
    }),
    ``,
    `---`,
    ``,
    ...report.patterns.flatMap(p => [
      `## Pattern: ${p.pattern}`,
      ``,
      `**Occurrences:** ${p.count} across ${p.files.length} file(s)`,
      ``,
      `**Files:**`,
      ...p.files.map(f => `- \`${f}\``),
      ``,
      `**Live Example (first match):**`,
      `\`\`\`typescript`,
      p.example + '...',
      `\`\`\``,
      ``,
      `**Proposed DSL form:**`,
      `\`\`\``,
      p.dslCandidate,
      `\`\`\``,
      ``,
      `---`,
      ``,
    ]),
    `## Next Steps`,
    ``,
    `1. Approve the top DSL candidates above`,
    `2. Build the CODEX-DELTA compiler for each approved pattern`,
    `3. Migrate existing code to DSL form (run \`tsc\` to validate after each)`,
    `4. Track boilerplate line count reduction as a Phase 4 metric`,
  ];

  return lines.join('\n');
}

// ─── Entry Point ─────────────────────────────────────────

const cliArgs = process.argv.slice(2);
const command = cliArgs[0] ?? 'report';
const REPO_ROOT = path.resolve(process.cwd(), '../..');
const OUTPUT = path.join(REPO_ROOT, 'dsl-candidates.md');

async function main(): Promise<void> {
  console.log('[codex-delta] Scanning for structural patterns in:', REPO_ROOT);
  const report = await analyzePatterns(REPO_ROOT);

  if (command === 'analyze') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const markdown = buildReport(report);
  fs.writeFileSync(OUTPUT, markdown, 'utf8');
  console.log(`[codex-delta] dsl-candidates.md written → ${OUTPUT}`);
  console.log(`[codex-delta] Patterns found: ${report.patterns.length} (from ${report.totalFilesScanned} files)`);
}

main().catch(err => {
  console.error('[codex-delta] Fatal:', err);
  process.exit(1);
});
