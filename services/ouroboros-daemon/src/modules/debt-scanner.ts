/**
 * Technical Debt Scanner Module
 * Helix α — Extension for ouroboros-daemon
 * Automated detection of agentic anti-patterns, sprawl, and system debt.
 */

import { randomUUID as uuidv4 } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// --- Types matching TECHNICAL_DEBT_TRACKER schema ---
export interface DebtItem {
  debt_id: string;
  category: 'code_sprawl' | 'config_drift' | 'orphaned_agent' | 'unused_skill' | 'schema_violation' | 'duplicate_route' | 'stale_dependency' | 'missing_test';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location: { file: string; line?: number; service?: string };
  detected_at: string;
  remediation: string;
  estimated_effort_hours: number;
  auto_fixable: boolean;
}

export interface DebtReport {
  report_id: string;
  scanned_at: string;
  total_items: number;
  score: number; // 0-100, lower = more debt
  items_by_severity: { critical: number; high: number; medium: number; low: number };
  items: DebtItem[];
  trend: 'improving' | 'stable' | 'degrading';
}

const reportHistory: DebtReport[] = [];

// --- Scanning Functions ---

async function scanOrphanedAgents(registryPath: string, servicesDir: string): Promise<DebtItem[]> {
  const items: DebtItem[] = [];
  try {
    const registry = JSON.parse(await fs.readFile(registryPath, 'utf-8'));
    const serviceDirs = await fs.readdir(servicesDir);
    const serviceSet = new Set(serviceDirs);

    for (const agent of registry.agents || []) {
      if (agent.service && !serviceSet.has(agent.service)) {
        items.push({
          debt_id: uuidv4(),
          category: 'orphaned_agent',
          severity: 'high',
          title: `Orphaned agent: ${agent.name}`,
          description: `Agent ${agent.name} references service "${agent.service}" which does not exist in services directory.`,
          location: { file: registryPath, service: agent.service },
          detected_at: new Date().toISOString(),
          remediation: `Either create the service "${agent.service}" or remove agent "${agent.agentId}" from the registry.`,
          estimated_effort_hours: 2,
          auto_fixable: false,
        });
      }
    }
  } catch (err: any) {
    console.error(`Orphaned agent scan failed: ${err.message}`);
  }
  return items;
}

async function scanDuplicateRoutes(routesDir: string): Promise<DebtItem[]> {
  const items: DebtItem[] = [];
  const routeMap = new Map<string, string[]>();

  try {
    const files = await fs.readdir(routesDir);
    for (const file of files.filter(f => f.endsWith('.routes.json'))) {
      const manifest = JSON.parse(await fs.readFile(path.join(routesDir, file), 'utf-8'));
      for (const route of manifest.routes || []) {
        const key = `${route.method}:${route.path}`;
        if (!routeMap.has(key)) routeMap.set(key, []);
        routeMap.get(key)!.push(file);
      }
    }

    for (const [route, files] of routeMap) {
      if (files.length > 1) {
        items.push({
          debt_id: uuidv4(),
          category: 'duplicate_route',
          severity: 'critical',
          title: `Duplicate route: ${route}`,
          description: `Route ${route} is defined in multiple manifests: ${files.join(', ')}`,
          location: { file: path.join(routesDir, files[0]) },
          detected_at: new Date().toISOString(),
          remediation: `Consolidate route ${route} into a single manifest.`,
          estimated_effort_hours: 1,
          auto_fixable: false,
        });
      }
    }
  } catch (err: any) {
    console.error(`Route scan failed: ${err.message}`);
  }
  return items;
}

async function scanMissingTests(servicesDir: string): Promise<DebtItem[]> {
  const items: DebtItem[] = [];
  try {
    const services = await fs.readdir(servicesDir);
    for (const svc of services) {
      const svcPath = path.join(servicesDir, svc);
      const stat = await fs.stat(svcPath).catch(() => null);
      if (!stat?.isDirectory()) continue;

      const pkgPath = path.join(svcPath, 'package.json');
      const hasPkg = await fs.access(pkgPath).then(() => true).catch(() => false);
      if (!hasPkg) continue;

      // Check for test directory or test files
      const hasTests = await fs.readdir(path.join(svcPath, 'src'))
        .then(files => files.some(f => f.includes('.test.') || f.includes('.spec.') || f === '__tests__'))
        .catch(() => false);

      const hasTestDir = await fs.access(path.join(svcPath, 'tests')).then(() => true)
        .catch(() => fs.access(path.join(svcPath, '__tests__')).then(() => true).catch(() => false));

      if (!hasTests && !hasTestDir) {
        items.push({
          debt_id: uuidv4(),
          category: 'missing_test',
          severity: 'medium',
          title: `Missing tests: ${svc}`,
          description: `Service ${svc} has no test files or test directory.`,
          location: { file: svcPath, service: svc },
          detected_at: new Date().toISOString(),
          remediation: `Add test coverage for service ${svc}. Create a tests/ directory with integration and unit tests.`,
          estimated_effort_hours: 4,
          auto_fixable: false,
        });
      }
    }
  } catch (err: any) {
    console.error(`Test scan failed: ${err.message}`);
  }
  return items;
}

async function scanSchemaViolations(schemasDir: string): Promise<DebtItem[]> {
  const items: DebtItem[] = [];
  try {
    const files = await fs.readdir(schemasDir);
    for (const file of files.filter(f => f.endsWith('.schema.json'))) {
      try {
        const schema = JSON.parse(await fs.readFile(path.join(schemasDir, file), 'utf-8'));
        if (!schema.$schema) {
          items.push({
            debt_id: uuidv4(),
            category: 'schema_violation',
            severity: 'low',
            title: `Missing $schema declaration: ${file}`,
            description: `Schema file ${file} does not declare a $schema meta-schema reference.`,
            location: { file: path.join(schemasDir, file) },
            detected_at: new Date().toISOString(),
            remediation: `Add "$schema": "https://json-schema.org/draft/2020-12/schema" to ${file}.`,
            estimated_effort_hours: 0.25,
            auto_fixable: true,
          });
        }
      } catch {
        items.push({
          debt_id: uuidv4(),
          category: 'schema_violation',
          severity: 'critical',
          title: `Invalid JSON: ${file}`,
          description: `Schema file ${file} contains invalid JSON.`,
          location: { file: path.join(schemasDir, file) },
          detected_at: new Date().toISOString(),
          remediation: `Fix JSON syntax errors in ${file}.`,
          estimated_effort_hours: 0.5,
          auto_fixable: false,
        });
      }
    }
  } catch (err: any) {
    console.error(`Schema scan failed: ${err.message}`);
  }
  return items;
}

// --- Main Scanner ---
export async function runDebtScan(config: {
  registryPath: string;
  servicesDir: string;
  routesDir: string;
  schemasDir: string;
}): Promise<DebtReport> {
  const allItems: DebtItem[] = [];

  const [orphaned, routes, tests, schemas] = await Promise.all([
    scanOrphanedAgents(config.registryPath, config.servicesDir),
    scanDuplicateRoutes(config.routesDir),
    scanMissingTests(config.servicesDir),
    scanSchemaViolations(config.schemasDir),
  ]);

  allItems.push(...orphaned, ...routes, ...tests, ...schemas);

  const bySeverity = {
    critical: allItems.filter(i => i.severity === 'critical').length,
    high: allItems.filter(i => i.severity === 'high').length,
    medium: allItems.filter(i => i.severity === 'medium').length,
    low: allItems.filter(i => i.severity === 'low').length,
  };

  const score = Math.max(0, 100 - (bySeverity.critical * 15 + bySeverity.high * 8 + bySeverity.medium * 3 + bySeverity.low * 1));

  const prevScore = reportHistory.length > 0 ? reportHistory[reportHistory.length - 1].score : score;
  const trend = score > prevScore + 2 ? 'improving' : score < prevScore - 2 ? 'degrading' : 'stable';

  const report: DebtReport = {
    report_id: uuidv4(),
    scanned_at: new Date().toISOString(),
    total_items: allItems.length,
    score,
    items_by_severity: bySeverity,
    items: allItems,
    trend,
  };

  reportHistory.push(report);
  return report;
}

export function getDebtHistory(): DebtReport[] {
  return reportHistory;
}
