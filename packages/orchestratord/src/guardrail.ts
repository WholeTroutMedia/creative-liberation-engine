import * as fs from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-ignore
import { validatePrompt, validateCommand } from '../../constitutional-governance/src/index.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export interface ConstitutionalPrinciple {
  id: string;
  statement: string;
  enforcedBy: string[];
}

export class ConstitutionalGuardrail {
  private principles: Map<string, ConstitutionalPrinciple> = new Map();

  constructor() {
    this.loadConstitution();
  }

  private loadConstitution(): void {
    try {
      const constitutionPath = join(__dirname, '../../../../docs/V6_CONSTITUTION.md');
      if (fs.existsSync(constitutionPath)) {
        const content = fs.readFileSync(constitutionPath, 'utf-8');
        
        // Simple regex-based extraction of Principle IDs and Statements
        const principleRegex = /###\s+([^\n]+)\n\n-\s+Principle ID:\s+`([^`]+)`\n-\s+Statement:\s+([^\n]+)/g;
        let match;
        
        while ((match = principleRegex.exec(content)) !== null) {
          const name = match[1];
          const id = match[2];
          const statement = match[3];
          
          this.principles.set(id, {
            id,
            statement,
            enforcedBy: []
          });
        }
      }
    } catch (err) {
      console.error(`[GUARDRAIL ERROR] Failed to parse V6_CONSTITUTION.md:`, err);
    }
  }

  /**
   * Evaluates input actions/payloads before execution
   */
  public async verifyAction(payload: Record<string, any>): Promise<{ compliant: boolean; violations: string[] }> {
    const violations: string[] = [];

    // 1. Prompt Injection Validation
    if (payload.prompt) {
      const promptValidation = validatePrompt(payload.prompt);
      if (!promptValidation.valid) {
        violations.push(`[PROMPT INJECTION] ${promptValidation.reason}`);
      }
    }

    // 2. Shell Command Safety Validation
    if (payload.command) {
      const commandValidation = validateCommand(payload.command);
      if (!commandValidation.valid) {
        violations.push(`[UNSAFE COMMAND] ${commandValidation.reason}`);
      }
    }

    // 3. Article 0 / Sovereignty Checks
    if (payload.restrictUserSovereignty === true || payload.vendorLockIn === true) {
      violations.push(`[GOVERNANCE REJECTION] Violates Article 0: Attempts to restrict creator autonomy or enforce vendor lock-in.`);
    }

    // 4. Article XXIV: Biometric Data Sovereignty Check
    if (payload.biometricData || payload.heartRate || payload.heartRateVariabilityMs) {
      if (payload.exportToCloud === true) {
        violations.push(`[BIOMETRIC REJECTION] Violates Article XXIV: Biometric data cannot be exported to cloud-native endpoints.`);
      }
    }

    return {
      compliant: violations.length === 0,
      violations
    };
  }

  /**
   * Evaluates output responses/code after execution
   */
  public async verifyOutput(output: any): Promise<{ compliant: boolean; violations: string[] }> {
    const violations: string[] = [];
    const serialized = typeof output === 'string' ? output : JSON.stringify(output);

    // Heuristics for private key leaks, credential spills, and prompt leaks
    const leakPatterns = [
      /sk-[a-zA-Z0-9]{48}/, // OpenAI keys
      /AIzaSy[a-zA-Z0-9-_]{35}/, // Google API keys
      /-----BEGIN PRIVATE KEY-----/,
      /system_prompt/i, // Prompt leak signatures
      /restrictUserSovereignty/i
    ];

    for (const pattern of leakPatterns) {
      if (pattern.test(serialized)) {
        violations.push(`[LEAK DETECTION] Output contains potential private credential or system configurations: ${pattern.toString()}`);
      }
    }

    return {
      compliant: violations.length === 0,
      violations
    };
  }
}
