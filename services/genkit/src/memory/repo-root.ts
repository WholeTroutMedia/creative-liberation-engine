/**
 * Resolve creative-liberation-engine-v5 repo root for HANDOFF.md and path-stable IO.
 * Prefer CLE_REPO_ROOT; otherwise derive from this file's location
 * (packages/genkit/src/memory -> four levels up).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Known legacy roots (fallback only if env and derivation fail). */
const LEGACY_ROOTS = [
  path.join('D:', 'Google Antigravity', 'Infusion Engine Brainchild', 'creative-liberation-engine-v5'),
  path.join('D:', 'Google Antigravity', 'Infusion Engine Brainchild', 'creative-liberation-engine-v4'),
];

function isRepoRoot(dir: string): boolean {
  try {
    const pkg = path.join(dir, 'package.json');
    if (!fs.existsSync(pkg)) return false;
    const raw = fs.readFileSync(pkg, 'utf-8');
    const j = JSON.parse(raw) as { name?: string };
    return j.name === 'creative-liberation-engine-v5' || fs.existsSync(path.join(dir, 'packages', 'genkit'));
  } catch {
    return false;
  }
}

/**
 * Absolute path to creative-liberation-engine-v5 root (directory containing `packages/genkit`).
 */
export function resolveBrainchildV5Root(): string {
  const env = process.env.CLE_REPO_ROOT;
  if (env && env.trim().length > 0) {
    return path.resolve(env.trim());
  }

  const fromFile = path.resolve(__dirname, '../../../..');
  if (isRepoRoot(fromFile)) {
    return fromFile;
  }

  for (const legacy of LEGACY_ROOTS) {
    if (fs.existsSync(path.join(legacy, 'HANDOFF.md')) || isRepoRoot(legacy)) {
      return legacy;
    }
  }

  return fromFile;
}

export function resolveHandoffMdPath(): string {
  return path.join(resolveBrainchildV5Root(), 'HANDOFF.md');
}
