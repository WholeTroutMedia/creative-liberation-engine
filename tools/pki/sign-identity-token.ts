#!/usr/bin/env npx ts-node
/**
 * Creative Liberation Engine V6 — Agent Identity Token Signer
 *
 * Client-side utility for agents to sign identity tokens.
 * Used when mTLS is not available (e.g., through tunnels, from
 * external environments, or during development).
 *
 * The signed token is sent in the X-Agent-Identity header.
 *
 * Usage:
 *   import { signIdentityToken } from './sign-identity-token';
 *   const token = signIdentityToken('atlas', '/path/to/atlas.key');
 *   // Set header: X-Agent-Identity: <token>
 */

import crypto from 'crypto';
import fs from 'fs';

export interface IdentityTokenPayload {
  agentId: string;
  timestamp: string;
  nonce: string;
}

/**
 * Create a signed agent identity token.
 *
 * Format: base64(json{agentId, timestamp, nonce}).base64(signature)
 *
 * @param agentId - The canonical agent ID
 * @param privateKeyPath - Path to the agent's private key file
 * @returns Signed token string for the X-Agent-Identity header
 */
export function signIdentityToken(agentId: string, privateKeyPath: string): string {
  const payload: IdentityTokenPayload = {
    agentId,
    timestamp: new Date().toISOString(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');

  const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');
  const signer = crypto.createSign('SHA256');
  signer.update(payloadB64);
  const signatureB64 = signer.sign(privateKey, 'base64');

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Helper to build auth headers for dispatch requests.
 *
 * @param agentId - The canonical agent ID
 * @param privateKeyPath - Path to the agent's private key file
 * @returns Headers object with X-Agent-Identity set
 */
export function getAgentAuthHeaders(
  agentId: string,
  privateKeyPath: string
): Record<string, string> {
  return {
    'X-Agent-Identity': signIdentityToken(agentId, privateKeyPath),
  };
}

// CLI mode — print token to stdout for manual testing
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: sign-identity-token.ts <agentId> <privateKeyPath>');
    process.exit(1);
  }

  const [agentId, keyPath] = args;
  const token = signIdentityToken(agentId, keyPath);
  console.log(token);
}
