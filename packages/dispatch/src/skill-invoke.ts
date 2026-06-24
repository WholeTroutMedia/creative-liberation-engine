/**
 * SkillInvoker — Agent-to-agent skill dispatch service
 *
 * Loads SKILL.md files from .agents/skills/<name>/SKILL.md,
 * serves their instructions over REST, and records invocation
 * telemetry so the IPSV-SPINE loop can track which skill is active.
 *
 * Route: POST /api/skills/invoke
 * Route: GET  /api/skills
 * Route: GET  /api/skills/:name
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// ── Types ─────────────────────────────────────────────────────────

export interface SkillFrontmatter {
  name: string;
  version: string;
  last_modified: string;
  constitutional_articles: string[];
  lead_agents: string[];
  scribe_on_complete: boolean;
  agentCallable: boolean;
  description?: string;
}

export interface SkillRecord {
  slug: string;
  frontmatter: SkillFrontmatter;
  instructions: string;
  filePath: string;
  loadedAt: string;
}

export interface SkillInvokeRequest {
  skill: string;
  trigger: string;
  context?: Record<string, unknown>;
  calledBy?: string;
  taskId?: string;
}

export interface SkillInvokeResponse {
  ok: boolean;
  skill: string;
  version: string;
  trigger: string;
  calledBy: string;
  leadAgents: string[];
  instructions: string;
  constitutionalArticles: string[];
  invokedAt: string;
  error?: string;
}

export interface SkillInvocationLog {
  skill: string;
  trigger: string;
  calledBy: string;
  taskId?: string;
  invokedAt: string;
  durationMs?: number;
  status: 'invoked' | 'completed' | 'failed';
}

// ── SkillInvoker ──────────────────────────────────────────────────

export class SkillInvoker {
  private skillsDir: string;
  private cache: Map<string, SkillRecord> = new Map();
  private invocationLog: SkillInvocationLog[] = [];
  private lastScan: number = 0;

  constructor(skillsDir?: string) {
    // Resolve relative to repo root — works both locally and on NAS
    this.skillsDir = skillsDir ?? resolve(process.cwd(), '.agents/skills');
  }

  // ── Public API ────────────────────────────────────────────────

  /** Invoke a skill by name. Returns its instructions + metadata for agent consumption. */
  invoke(req: SkillInvokeRequest): SkillInvokeResponse {
    this.scanIfStale();

    const record = this.cache.get(req.skill.toLowerCase());
    if (!record) {
      const available = Array.from(this.cache.keys()).join(', ');
      return {
        ok: false,
        skill: req.skill,
        version: 'unknown',
        trigger: req.trigger,
        calledBy: req.calledBy ?? 'unknown',
        leadAgents: [],
        instructions: '',
        constitutionalArticles: [],
        invokedAt: new Date().toISOString(),
        error: `Skill "${req.skill}" not found. Available: [${available}]`,
      };
    }

    if (!record.frontmatter.agentCallable) {
      return {
        ok: false,
        skill: req.skill,
        version: record.frontmatter.version,
        trigger: req.trigger,
        calledBy: req.calledBy ?? 'unknown',
        leadAgents: record.frontmatter.lead_agents,
        instructions: '',
        constitutionalArticles: record.frontmatter.constitutional_articles,
        invokedAt: new Date().toISOString(),
        error: `Skill "${req.skill}" is not marked agentCallable. Human invocation only.`,
      };
    }

    const log: SkillInvocationLog = {
      skill: req.skill,
      trigger: req.trigger,
      calledBy: req.calledBy ?? 'system',
      taskId: req.taskId,
      invokedAt: new Date().toISOString(),
      status: 'invoked',
    };
    this.invocationLog.push(log);
    // Keep log bounded
    if (this.invocationLog.length > 500) this.invocationLog.shift();

    return {
      ok: true,
      skill: req.skill,
      version: record.frontmatter.version,
      trigger: req.trigger,
      calledBy: req.calledBy ?? 'system',
      leadAgents: record.frontmatter.lead_agents,
      instructions: record.instructions,
      constitutionalArticles: record.frontmatter.constitutional_articles,
      invokedAt: log.invokedAt,
    };
  }

  /** List all available skills with their metadata. */
  list(): Array<Omit<SkillRecord, 'instructions'>> {
    this.scanIfStale();
    return Array.from(this.cache.values()).map(({ instructions: _instructions, ...rest }) => rest);
  }

  /** Get a single skill record by slug. */
  get(slug: string): SkillRecord | undefined {
    this.scanIfStale();
    return this.cache.get(slug.toLowerCase());
  }

  /** Get recent invocation telemetry. */
  getLog(limit = 50): SkillInvocationLog[] {
    return this.invocationLog.slice(-limit);
  }

  /** Force cache refresh. */
  refresh(): number {
    this.cache.clear();
    this.lastScan = 0;
    return this.scan();
  }

  // ── Private ───────────────────────────────────────────────────

  private scanIfStale(): void {
    const now = Date.now();
    // Re-scan every 60 seconds to pick up new/modified SKILL.md files (hot-reload)
    if (now - this.lastScan > 60_000) {
      this.scan();
    }
  }

  private scan(): number {
    if (!existsSync(this.skillsDir)) {
      console.warn(`[SkillInvoker] Skills directory not found: ${this.skillsDir}`);
      this.lastScan = Date.now();
      return 0;
    }

    let loaded = 0;
    const entries = readdirSync(this.skillsDir);

    for (const entry of entries) {
      const skillDir = join(this.skillsDir, entry);
      if (!statSync(skillDir).isDirectory()) continue;

      const skillFile = join(skillDir, 'SKILL.md');
      if (!existsSync(skillFile)) continue;

      try {
        const content = readFileSync(skillFile, 'utf-8');
        const record = this.parseSkillMd(skillFile, entry, content);
        this.cache.set(entry.toLowerCase(), record);
        loaded++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[SkillInvoker] Failed to parse ${skillFile}: ${msg}`);
      }
    }

    this.lastScan = Date.now();
    console.log(`[SkillInvoker] Loaded ${loaded} skills from ${this.skillsDir}`);
    return loaded;
  }

  private parseSkillMd(filePath: string, slug: string, content: string): SkillRecord {
    // Extract YAML frontmatter between --- delimiters
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fmMatch) {
      throw new Error(`No YAML frontmatter found in ${filePath}`);
    }

    const [, yamlRaw, instructions] = fmMatch;
    const frontmatter = this.parseSimpleYaml(yamlRaw, slug);

    return {
      slug: slug.toLowerCase(),
      frontmatter,
      instructions: instructions.trim(),
      filePath,
      loadedAt: new Date().toISOString(),
    };
  }

  /**
   * Minimal YAML parser for skill frontmatter.
   * Handles strings, booleans, and inline arrays only — sufficient for SKILL.md format.
   */
  private parseSimpleYaml(yaml: string, slug: string): SkillFrontmatter {
    const get = (key: string, fallback: string): string => {
      const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : fallback;
    };

    const getBool = (key: string, fallback: boolean): boolean => {
      const m = yaml.match(new RegExp(`^${key}:\\s*(true|false)$`, 'm'));
      return m ? m[1] === 'true' : fallback;
    };

    const getList = (key: string): string[] => {
      // Matches: key: [item1, item2] or multi-line list items starting with "  - item"
      const inlineMatch = yaml.match(new RegExp(`^${key}:\\s*\\[(.+)\\]$`, 'm'));
      if (inlineMatch) {
        return inlineMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      }
      // Multi-line list
      const blockMatch = yaml.match(new RegExp(`^${key}:[\\s\\S]*?(?=\\n\\w|$)`, 'm'));
      if (blockMatch) {
        const lines = blockMatch[0].split('\n').slice(1);
        return lines
          .map(l => l.trim().replace(/^-\s*/, '').replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
      }
      return [];
    };

    return {
      name: get('name', slug),
      version: get('version', '1.0.0'),
      last_modified: get('last_modified', ''),
      constitutional_articles: getList('constitutional_articles'),
      lead_agents: getList('lead_agents'),
      scribe_on_complete: getBool('scribe_on_complete', false),
      agentCallable: getBool('agentCallable', false),
      description: get('description', ''),
    };
  }
}
