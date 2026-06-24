import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { ReasoningEngine } from './reasoning.js';

const logger = pino({
  name: 'reasoning-core:self-harness',
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined
});

export interface SelfHarnessRequest {
  rules: string[];
  context: string;
  performanceMetrics?: Record<string, any>;
}

export interface RuleModification {
  original: string;
  proposed: string;
  rationale: string;
}

export interface SelfHarnessResponse {
  optimizedRules: string[];
  sandboxCheckPassed: boolean;
  modifications: RuleModification[];
  errorMessage?: string;
}

export class SelfHarnessOptimizer {
  private engine: ReasoningEngine;
  private constitutionPath: string;

  constructor(engine: ReasoningEngine) {
    this.engine = engine;
    this.constitutionPath = process.env.CONSTITUTION_PATH || path.resolve(process.cwd(), '../../docs/V6_CONSTITUTION.md');
  }

  /**
   * Load the immutable system constitution
   */
  private loadConstitution(): string {
    try {
      if (fs.existsSync(this.constitutionPath)) {
        return fs.readFileSync(this.constitutionPath, 'utf-8');
      }
      logger.warn({ path: this.constitutionPath }, 'Constitution file not found, falling back to basic check');
      return 'V6 Constitution Core Mandates: Article I (Sovereignty), Article IX (Never ship an MVP), Article XX (Zero human wait time)';
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to read constitution file');
      throw new Error(`Failed to load constitution: ${err.message}`);
    }
  }

  /**
   * Run optimization using LLM-as-a-Judge and rewrite heuristics
   */
  public async optimizeRules(request: SelfHarnessRequest): Promise<SelfHarnessResponse> {
    logger.info({ context: request.context }, 'Starting Self-Harness rule optimization');

    const constitution = this.loadConstitution();
    
    // 1. Construct optimization prompt
    const prompt = `
You are the Creative Liberation Engine Self-Harness Optimizer.
Your job is to optimize the following operational rules (heuristics) for the target context: "${request.context}".
Optimize rules to improve speed, performance, clarity, and resource efficiency.

[CONSTITUTIONAL SANDBOX - IMMUTABLE CORE MANDATES]
The following constitution is strictly read-only and CANNOT be modified, bypassed, or weakened:
${constitution}

[CURRENT OPERATIONAL RULES]
${request.rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

[OPTIONAL PERFORMANCE METRICS]
${request.performanceMetrics ? JSON.stringify(request.performanceMetrics, null, 2) : 'None provided'}

Your output MUST be a JSON object with this exact structure:
{
  "optimizedRules": [
    "rule 1 content...",
    "rule 2 content..."
  ],
  "modifications": [
    {
      "original": "original rule text",
      "proposed": "new optimized rule text",
      "rationale": "why this change improves performance or fits the context"
    }
  ]
}

Ensure that no rule modifications weaken, delete, or override any Constitutional Articles or V6 core mandates. If any rule attempts to bypass the constitution, it will fail validation.
Output raw JSON only.
`;

    try {
      // 2. Query LLM
      const completion = await (this.engine as any).queryLLM(prompt, 'You are a system optimizer. Output raw JSON only.', undefined, 0.3);
      const cleaned = completion.substring(completion.indexOf('{'), completion.lastIndexOf('}') + 1);
      const parsed = JSON.parse(cleaned);

      const optimizedRules: string[] = parsed.optimizedRules || [];
      const modifications: RuleModification[] = parsed.modifications || [];

      // 3. Perform Sandbox Verification Checks
      const validation = this.verifyRulesAgainstConstitution(optimizedRules, constitution);
      
      if (!validation.passed) {
        logger.warn({ error: validation.error }, 'Self-Harness optimization rejected by Constitutional Sandbox');
        return {
          optimizedRules: request.rules, // revert to original
          sandboxCheckPassed: false,
          modifications: [],
          errorMessage: validation.error
        };
      }

      logger.info('Self-Harness rules optimization successfully validated and passed sandbox checks.');
      return {
        optimizedRules,
        sandboxCheckPassed: true,
        modifications
      };
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to optimize rules in self-harness');
      return {
        optimizedRules: request.rules,
        sandboxCheckPassed: false,
        modifications: [],
        errorMessage: `Optimization runtime error: ${err.message}`
      };
    }
  }

  /**
   * Verify proposed rules against the immutable constitution
   */
  private verifyRulesAgainstConstitution(proposedRules: string[], constitution: string): { passed: boolean; error?: string } {
    // Check for explicit violations in the text (e.g., trying to override Articles)
    const normalizedConst = constitution.toLowerCase();
    
    for (const rule of proposedRules) {
      const lowerRule = rule.toLowerCase();
      
      // Prevent attempts to disable or modify articles
      if (lowerRule.includes('disable article') || lowerRule.includes('bypass article') || lowerRule.includes('override article') || lowerRule.includes('ignore article') || lowerRule.includes('modify constitution')) {
        return {
          passed: false,
          error: `Constitutional Guardrail Violation: Rule attempts to bypass or disable a core article: "${rule}"`
        };
      }
      
      // Programmatic regex checks for core articles
      if (/article\s+(i+|v|x)\b/i.test(rule) && (lowerRule.includes('not apply') || lowerRule.includes('disabled') || lowerRule.includes('bypass') || lowerRule.includes('waived') || lowerRule.includes('ignore'))) {
        return {
          passed: false,
          error: `Constitutional Guardrail Violation: Core Article rule waiver detected: "${rule}"`
        };
      }
    }

    return { passed: true };
  }
}
