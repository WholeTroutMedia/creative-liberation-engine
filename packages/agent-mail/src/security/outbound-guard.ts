/**
 * CLE Agent Mail — Outbound PII/Credential Guard
 *
 * Scans outbound email body for sensitive patterns before send.
 * Blocks the send and alerts operator if PII or credentials detected.
 * Borrowed concept from AgenticMail's content guard.
 */

import type { OutboundScanResult } from '../types';

/** Patterns that should NEVER appear in an outbound agent email */
const PII_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  // Social Security Numbers (XXX-XX-XXXX)
  { name: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  // Credit card numbers (13-19 digit sequences)
  { name: 'Credit Card', regex: /\b(?:\d[ -]*?){13,19}\b/g },
  // API keys (common patterns: sk-*, pk-*, key-*, AKIA*)
  { name: 'API Key (sk-)', regex: /\bsk-[a-zA-Z0-9_-]{20,}\b/g },
  { name: 'API Key (pk-)', regex: /\bpk-[a-zA-Z0-9_-]{20,}\b/g },
  { name: 'API Key (key-)', regex: /\bkey-[a-zA-Z0-9_-]{20,}\b/g },
  { name: 'AWS Access Key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  // Bearer tokens
  { name: 'Bearer Token', regex: /\bBearer\s+[a-zA-Z0-9_\-.]{20,}\b/gi },
  // Private keys
  { name: 'Private Key', regex: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi },
  // Password assignments
  { name: 'Password', regex: /password\s*[:=]\s*['"][^'"]{4,}['"]/gi },
  // Passwords in URLs
  { name: 'Password in URL', regex: /:\/\/[^:]+:[^@]+@/g },
  // JWT tokens
  { name: 'JWT Token', regex: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g },
];

/**
 * Scan outbound message content for PII and credential patterns.
 * Returns { passed: true } if clean, or { passed: false, violations: [...] } if blocked.
 */
export function scanOutbound(body: string, subject?: string): OutboundScanResult {
  const textToScan = `${subject ?? ''}\n${body}`;
  const violations: string[] = [];

  for (const pattern of PII_PATTERNS) {
    const matches = textToScan.match(pattern.regex);
    if (matches) {
      violations.push(`${pattern.name}: ${matches.length} occurrence(s) detected`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
