/**
 * @cle/constitutional-governance
 *
 * Implements VERA-aligned Prompt Injection Guardrails and Command Validation logic.
 * Part of Wave 2 security operating system (IE-SOS).
 */

const SUSPICIOUS_PROMPT_PATTERNS = [
  /ignore previous instructions/i,
  /you are now in developer mode/i,
  /bypass safety/i,
  /dan mode/i,
  /jailbreak/i,
  /override system prompt/i,
  /output raw system configuration/i
];

const SUSPICIOUS_COMMAND_PATTERNS = [
  /rm\s+-rf\s+\//,
  /curl\s+.*\s*\|\s*sh/,
  /wget\s+.*\s*\|\s*sh/,
  /\.\.\/\.\.\//, // Directory traversal
  /chmod\s+777/,
  /chown\s+root/
];

/**
 * Validates a prompt input against prompt injection patterns.
 * @param {string} prompt
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, reason: 'Invalid prompt type: must be a string' };
  }

  for (const pattern of SUSPICIOUS_PROMPT_PATTERNS) {
    if (pattern.test(prompt)) {
      return {
        valid: false,
        reason: `Potential prompt injection signature detected: ${pattern.toString()}`
      };
    }
  }

  return { valid: true };
}

/**
 * Validates a system command against execution safety rules.
 * @param {string} command
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateCommand(command) {
  if (!command || typeof command !== 'string') {
    return { valid: false, reason: 'Invalid command type: must be a string' };
  }

  for (const pattern of SUSPICIOUS_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return {
        valid: false,
        reason: `Forbidden system command pattern detected: ${pattern.toString()}`
      };
    }
  }

  return { valid: true };
}
