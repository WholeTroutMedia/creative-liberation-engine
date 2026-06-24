import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Creative Liberation Engine V6 — Agent Identity Verification Middleware
 *
 * Implements zero-trust agent authentication for the dispatch server.
 * Supports two modes:
 *
 * 1. **mTLS mode** (production): Agent presents a client certificate signed
 *    by the Creative Liberation Engine Root CA. The middleware verifies the cert chain
 *    and extracts the agentId from the CN field.
 *
 * 2. **Token mode** (development/tunnel): Agent presents a signed JWT in the
 *    X-Agent-Identity header. The token contains the agentId and is signed
 *    with the agent's private key.
 *
 * Both modes populate `req.agentIdentity` with the verified identity.
 *
 * Configuration via environment:
 *   AGENT_AUTH_MODE=mtls|token|permissive    (default: permissive)
 *   CLE_CA_CERT=/path/to/cle-ca.crt
 *   AGENT_IDENTITY_DIR=/path/to/pki/agents
 */

export interface AgentIdentity {
  agentId: string;
  verifiedVia: 'mtls' | 'token' | 'api_key' | 'permissive';
  meshZone: 'core' | 'edge' | 'external' | 'client';
  certFingerprint?: string;
  verifiedAt: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      agentIdentity?: AgentIdentity;
    }
  }
}

/** Trusted agent fingerprints cache (loaded from identity index) */
let trustedFingerprints: Map<string, string> | null = null;

function loadTrustedFingerprints(identityDir: string): Map<string, string> {
  if (trustedFingerprints) return trustedFingerprints;

  trustedFingerprints = new Map();
  const indexPath = path.join(identityDir, 'identity-index.json');

  if (fs.existsSync(indexPath)) {
    try {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      for (const entry of index.agents || []) {
        if (entry.status === 'active' && entry.certFingerprint) {
          trustedFingerprints.set(entry.certFingerprint, entry.agentId);
        }
      }
      console.log(`[IDENTITY] Loaded ${trustedFingerprints.size} trusted agent fingerprints`);
    } catch (err) {
      console.error('[IDENTITY] Failed to load identity index:', err);
    }
  }

  return trustedFingerprints;
}

/**
 * Extract agentId from an mTLS client certificate.
 * The certificate must be signed by the Creative Liberation Engine Root CA.
 */
function verifyMtls(req: Request): AgentIdentity | null {
  // In Node.js with TLS, the client cert is available on the socket
  const socket = req.socket as any;
  const cert = socket?.getPeerCertificate?.();

  if (!cert || !cert.subject) return null;

  const cn = cert.subject.CN;
  if (!cn) return null;

  // Verify the cert was issued by our CA
  const authorized = socket.authorized;
  if (!authorized) {
    console.warn(`[IDENTITY] mTLS: Unauthorized cert from CN=${cn}`);
    return null;
  }

  // Compute fingerprint
  const fingerprint = cert.fingerprint256 || '';

  return {
    agentId: cn,
    verifiedVia: 'mtls',
    meshZone: 'core',
    certFingerprint: fingerprint,
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Verify a signed agent identity token from the X-Agent-Identity header.
 * Token format: base64(json{agentId, timestamp, nonce}).base64(signature)
 *
 * The signature is verified against the agent's public certificate.
 */
function verifyToken(req: Request, identityDir: string): AgentIdentity | null {
  const header = req.headers['x-agent-identity'] as string | undefined;
  if (!header) return null;

  const parts = header.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signatureB64] = parts;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf-8'));
    const { agentId, timestamp, nonce } = payload;

    if (!agentId || !timestamp || !nonce) return null;

    // Reject tokens older than 5 minutes
    const tokenAge = Date.now() - new Date(timestamp).getTime();
    if (tokenAge > 5 * 60 * 1000 || tokenAge < -30_000) {
      console.warn(`[IDENTITY] Token expired or clock-skewed for ${agentId} (age: ${tokenAge}ms)`);
      return null;
    }

    // Load agent's public cert for signature verification
    const certPath = path.join(identityDir, `${agentId}.crt`);
    if (!fs.existsSync(certPath)) {
      console.warn(`[IDENTITY] No cert found for agent: ${agentId}`);
      return null;
    }

    const publicKey = fs.readFileSync(certPath, 'utf-8');
    const verifier = crypto.createVerify('SHA256');
    verifier.update(payloadB64);

    const isValid = verifier.verify(publicKey, signatureB64, 'base64');
    if (!isValid) {
      console.warn(`[IDENTITY] Invalid signature for agent: ${agentId}`);
      return null;
    }

    return {
      agentId,
      verifiedVia: 'token',
      meshZone: 'core',
      verifiedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[IDENTITY] Token verification error:', err);
    return null;
  }
}

/**
 * Agent Identity Verification Middleware Factory
 *
 * Returns Express middleware that verifies agent identity based on
 * the configured authentication mode.
 */
export function agentIdentityAuth(options?: {
  mode?: 'mtls' | 'token' | 'permissive';
  identityDir?: string;
  requireIdentity?: boolean;
}): (req: Request, res: Response, next: NextFunction) => void {
  const mode = options?.mode || (process.env.AGENT_AUTH_MODE as any) || 'permissive';
  const identityDir = options?.identityDir || process.env.AGENT_IDENTITY_DIR || '';
  const requireIdentity = options?.requireIdentity ?? false;

  return (req: Request, res: Response, next: NextFunction): void => {
    let identity: AgentIdentity | null = null;

    // Try mTLS first (always, regardless of mode)
    identity = verifyMtls(req);

    // Fall back to token verification
    if (!identity && identityDir) {
      identity = verifyToken(req, identityDir);
    }

    // Permissive mode: allow unauthenticated requests but tag them
    if (!identity && mode === 'permissive') {
      identity = {
        agentId: 'anonymous',
        verifiedVia: 'permissive',
        meshZone: 'external',
        verifiedAt: new Date().toISOString(),
      };
    }

    if (!identity && requireIdentity) {
      res.status(401).json({
        error: 'Agent identity required',
        hint: 'Provide a valid client certificate (mTLS) or X-Agent-Identity token',
      });
      return;
    }

    req.agentIdentity = identity || undefined;
    next();
  };
}
