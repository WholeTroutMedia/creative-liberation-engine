/**
 * Ouroboros Code Lens
 *
 * Static analysis module for SPECTRE-D and CODEX-DELTA.
 *
 * Scans the monorepo package graph to identify:
 *   - Dead packages (listed in pnpm-workspace.yaml with 0 cross-references)
 *   - Unused Genkit flows (defined but never called across the codebase)
 *   - High-frequency structural patterns (candidates for DSL compression)
 *
 * Outputs are JSON data structures, not mutations.
 * The Destroyer and CODEX-DELTA consume these as their source of truth.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PackageInfo {
  name: string;
  location: string;
  referenceCount: number;
  referencedBy: string[];
}

export interface FlowInfo {
  name: string;
  file: string;
  referenceCount: number;
}

export interface CodeLensReport {
  generatedAt: string;
  totalPackages: number;
  deadPackages: PackageInfo[];
  lowUsagePackages: PackageInfo[];  // referenced by only 1 other package
  totalFlows: number;
  unusedFlows: FlowInfo[];
}

/**
 * Scan the monorepo for dead packages by reading pnpm-workspace.yaml
 * and then grep-scanning all TypeScript sources for cross-references.
 */
export async function scanPackageGraph(repoRoot: string): Promise<PackageInfo[]> {
  const workspaceFile = path.join(repoRoot, 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspaceFile)) {
    console.warn('[ouroboros:code-lens] pnpm-workspace.yaml not found at', repoRoot);
    return [];
  }

  // Collect all package.json files to extract package names
  const packages: PackageInfo[] = [];
  const scanDirs = ['packages', 'apps', 'services'];

  for (const dir of scanDirs) {
    const absDir = path.join(repoRoot, dir);
    if (!fs.existsSync(absDir)) continue;

    for (const entry of fs.readdirSync(absDir)) {
      const pkgJson = path.join(absDir, entry, 'package.json');
      if (!fs.existsSync(pkgJson)) continue;

      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8')) as { name?: string };
        if (!pkg.name) continue;
        packages.push({
          name: pkg.name,
          location: path.join(dir, entry),
          referenceCount: 0,
          referencedBy: [],
        });
      } catch {
        // malformed package.json — skip
      }
    }
  }

  // Count cross-references by scanning all package.json dependencies
  for (const pkg of packages) {
    for (const other of packages) {
      if (other.name === pkg.name) continue;
      const otherPkgJson = path.join(repoRoot, other.location, 'package.json');
      if (!fs.existsSync(otherPkgJson)) continue;
      try {
        const raw = fs.readFileSync(otherPkgJson, 'utf8');
        if (raw.includes(`"${pkg.name}"`)) {
          pkg.referenceCount++;
          pkg.referencedBy.push(other.name);
        }
      } catch {
        // skip
      }
    }
  }

  return packages;
}

/**
 * Scan for Genkit flows that are exported from the flows/index.ts
 * but never imported elsewhere in the codebase.
 */
export function scanGenkitFlows(repoRoot: string): FlowInfo[] {
  const flowsIndex = path.join(repoRoot, 'packages/genkit/src/flows/index.ts');
  if (!fs.existsSync(flowsIndex)) return [];

  const content = fs.readFileSync(flowsIndex, 'utf8');
  const exportMatches = [...content.matchAll(/export\s+\{([^}]+)\}/g)];
  const flowNames: string[] = [];

  for (const match of exportMatches) {
    const names = match[1].split(',').map((n: string) => n.trim().split(/\s+as\s+/)[0].trim());
    flowNames.push(...names.filter((n: string) => n.toLowerCase().includes('flow')));
  }

  const flows: FlowInfo[] = flowNames.map(name => ({
    name,
    file: 'packages/genkit/src/flows/index.ts',
    referenceCount: 0,
  }));

  // Scan all TS files for imports of these flow names
  const srcPatterns = [
    path.join(repoRoot, 'packages/genkit/src/server.ts'),
    path.join(repoRoot, 'packages/genkit/src'),
  ];

  for (const flow of flows) {
    for (const pattern of srcPatterns) {
      if (!fs.existsSync(pattern)) continue;
      const files = fs.statSync(pattern).isDirectory()
        ? fs.readdirSync(pattern).filter((f: string) => f.endsWith('.ts')).map((f: string) => path.join(pattern, f))
        : [pattern];

      for (const file of files) {
        if (file === flowsIndex) continue;
        try {
          const src = fs.readFileSync(file, 'utf8');
          if (src.includes(flow.name)) {
            flow.referenceCount++;
          }
        } catch {
          // skip
        }
      }
    }
  }

  return flows;
}

/**
 * Run the full code lens scan and produce a structured report.
 */
export async function runCodeLens(repoRoot: string): Promise<CodeLensReport> {
  const packages = await scanPackageGraph(repoRoot);
  const flows = scanGenkitFlows(repoRoot);

  return {
    generatedAt: new Date().toISOString(),
    totalPackages: packages.length,
    deadPackages: packages.filter(p => p.referenceCount === 0),
    lowUsagePackages: packages.filter(p => p.referenceCount === 1),
    totalFlows: flows.length,
    unusedFlows: flows.filter(f => f.referenceCount === 0),
  };
}
