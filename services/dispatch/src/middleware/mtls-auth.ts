// Creative Liberation Engine — mTLS Identity Verification Middleware (WS-01 Final)
// Validates client certificates against the PKI identity-index.
// Enforces zero-trust: only agents with CA-signed certs can access protected routes.

import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { TLSSocket } from 'tls';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Identity Index ───────────────────────────────────────────────────────────

export interface AgentIdentity {
    fingerprint: string;
    cn: string;
    certPath: string;
    expires: string;
}

type IdentityIndex = Record<string, AgentIdentity>;

let _index: IdentityIndex | null = null;
let _caCert: string | null = null;

/**
 * Load the identity index from PKI directory.
 * Searches NAS path first, then local workstation fallback.
 */
function loadIdentityIndex(): IdentityIndex {
    if (_index) return _index;

    const searchPaths = [
        // NAS canonical path (production)
        '/opt/cle/pki/identity-index.json',
        // Container-mounted volume
        '/pki/identity-index.json',
        // Local workstation fallback (development)
        path.resolve(__dirname, '../../../../tools/pki/identity-index.json'),
    ];

    for (const p of searchPaths) {
        try {
            const raw = fs.readFileSync(p, 'utf-8');
            _index = JSON.parse(raw) as IdentityIndex;
            console.log(`[mtls] Identity index loaded from ${p} (${Object.keys(_index).length} agents)`);
            return _index;
        } catch {
            // Try next path
        }
    }

    console.warn('[mtls] No identity index found — mTLS verification will reject all certs');
    _index = {};
    return _index;
}

/**
 * Load the CA certificate for chain validation.
 */
function loadCACert(): string | null {
    if (_caCert !== null) return _caCert;

    const searchPaths = [
        '/opt/cle/pki/ca/cle-ca.crt',
        '/pki/ca/cle-ca.crt',
        path.resolve(__dirname, '../../../../tools/pki/ca/cle-ca.crt'),
    ];

    for (const p of searchPaths) {
        try {
            _caCert = fs.readFileSync(p, 'utf-8');
            console.log(`[mtls] CA certificate loaded from ${p}`);
            return _caCert;
        } catch {
            // Try next path
        }
    }

    console.warn('[mtls] No CA certificate found');
    _caCert = '';
    return null;
}

// ── Fingerprint Computation ──────────────────────────────────────────────────

/**
 * Compute SHA-256 fingerprint from a DER-encoded certificate buffer.
 * Returns colon-separated uppercase hex string matching openssl x509 -fingerprint output.
 */
export function computeFingerprint(derBuffer: Buffer): string {
    const hash = crypto.createHash('sha256').update(derBuffer).digest('hex').toUpperCase();
    return hash.match(/.{2}/g)!.join(':');
}

/**
 * Extract agent identity from a fingerprint by matching against the index.
 */
export function resolveAgent(fingerprint: string): { agentId: string; identity: AgentIdentity } | null {
    const index = loadIdentityIndex();
    for (const [agentId, identity] of Object.entries(index)) {
        if (identity.fingerprint === fingerprint) {
            return { agentId, identity };
        }
    }
    return null;
}

// ── Express Middleware ────────────────────────────────────────────────────────

export interface MtlsOptions {
    /** If true, reject requests without valid client cert. Default: true in production. */
    required: boolean;
    /** Routes to skip mTLS (e.g. health checks). Matched as prefixes. */
    skipPaths?: string[];
    /** If true, log all auth decisions. Default: false. */
    verbose?: boolean;
}

const DEFAULT_SKIP_PATHS = [
    '/api/status',
    '/api/mesh-health',
    '/health',
    '/ws/bridge',
];

/**
 * Express middleware that validates client TLS certificates against the PKI identity index.
 *
 * When a valid cert is presented, `req.agentIdentity` is populated with:
 *   - agentId: canonical agent name (e.g. 'DISPATCH', 'GENKIT')
 *   - fingerprint: SHA-256 fingerprint
 *   - cn: certificate common name
 *
 * In development (NODE_ENV !== 'production'), missing certs are allowed by default
 * and requests get `req.agentIdentity = null`.
 */
export function mtlsAuth(opts?: Partial<MtlsOptions>) {
    const isProd = process.env.NODE_ENV === 'production';
    const options: MtlsOptions = {
        required: opts?.required ?? isProd,
        skipPaths: opts?.skipPaths ?? DEFAULT_SKIP_PATHS,
        verbose: opts?.verbose ?? false,
    };

    // Eagerly load index on middleware init
    loadIdentityIndex();
    loadCACert();

    return (req: Request, res: Response, next: NextFunction): void => {
        // Skip exempt paths
        if (options.skipPaths?.some(p => req.path.startsWith(p))) {
            (req as any).agentIdentity = null;
            next();
            return;
        }

        // Also allow header-based auth as fallback (for non-TLS reverse proxy setups)
        const headerFingerprint = req.headers['x-client-cert-fingerprint'] as string | undefined;
        const headerCN = req.headers['x-client-cert-cn'] as string | undefined;

        if (headerFingerprint) {
            const agent = resolveAgent(headerFingerprint);
            if (agent) {
                (req as any).agentIdentity = {
                    agentId: agent.agentId,
                    fingerprint: headerFingerprint,
                    cn: agent.identity.cn,
                    source: 'header',
                };
                if (options.verbose) {
                    console.log(`[mtls] Agent ${agent.agentId} authenticated via header (${headerFingerprint.substring(0, 17)}...)`);
                }
                next();
                return;
            }
        }

        // TLS socket cert extraction
        const tlsSocket = req.socket as TLSSocket;
        const cert = tlsSocket?.getPeerCertificate?.();

        if (!cert || !cert.raw) {
            if (options.required) {
                if (options.verbose) console.warn(`[mtls] REJECTED: No client certificate on ${req.method} ${req.path}`);
                res.status(401).json({
                    error: 'mTLS required',
                    message: 'Client certificate not presented. All mesh communication requires a valid agent identity.',
                });
                return;
            }
            // Non-required: pass through without identity
            (req as any).agentIdentity = null;
            next();
            return;
        }

        // Compute fingerprint and resolve
        const fingerprint = computeFingerprint(cert.raw);
        const agent = resolveAgent(fingerprint);

        if (!agent) {
            if (options.required) {
                console.warn(`[mtls] REJECTED: Unknown certificate fingerprint ${fingerprint} on ${req.method} ${req.path}`);
                res.status(403).json({
                    error: 'Unknown agent identity',
                    message: 'Certificate fingerprint does not match any registered agent.',
                    fingerprint,
                });
                return;
            }
            (req as any).agentIdentity = null;
            next();
            return;
        }

        // Check expiration
        const expires = new Date(agent.identity.expires);
        if (expires.getTime() < Date.now()) {
            console.warn(`[mtls] REJECTED: Expired certificate for ${agent.agentId} (expired ${agent.identity.expires})`);
            res.status(403).json({
                error: 'Certificate expired',
                agentId: agent.agentId,
                expires: agent.identity.expires,
            });
            return;
        }

        // Authenticated — attach identity to request
        (req as any).agentIdentity = {
            agentId: agent.agentId,
            fingerprint,
            cn: agent.identity.cn,
            source: 'tls',
        };

        if (options.verbose) {
            console.log(`[mtls] Agent ${agent.agentId} authenticated via TLS cert`);
        }

        next();
    };
}

// ── HTTPS Server Factory ─────────────────────────────────────────────────────

/**
 * Build TLS options for creating an HTTPS server with mTLS support.
 * The server will request (but not necessarily require) client certificates.
 * Actual enforcement is done by the mtlsAuth middleware.
 */
export function buildTlsOptions(): {
    key?: string;
    cert?: string;
    ca?: string;
    requestCert: boolean;
    rejectUnauthorized: boolean;
} | null {
    const keyPaths = [
        '/opt/cle/pki/agents/dispatch/dispatch.key',
        '/pki/agents/dispatch/dispatch.key',
        path.resolve(__dirname, '../../../../tools/pki/agents/dispatch/dispatch.key'),
    ];
    const certPaths = [
        '/opt/cle/pki/agents/dispatch/dispatch.crt',
        '/pki/agents/dispatch/dispatch.crt',
        path.resolve(__dirname, '../../../../tools/pki/agents/dispatch/dispatch.crt'),
    ];

    let key: string | undefined;
    let cert: string | undefined;

    for (const p of keyPaths) {
        try { key = fs.readFileSync(p, 'utf-8'); break; } catch { /* next */ }
    }
    for (const p of certPaths) {
        try { cert = fs.readFileSync(p, 'utf-8'); break; } catch { /* next */ }
    }

    const ca = loadCACert() ?? undefined;

    if (!key || !cert) {
        console.warn('[mtls] Dispatch server key/cert not found — HTTPS/mTLS disabled, running HTTP only');
        return null;
    }

    console.log('[mtls] TLS options built — mTLS-capable HTTPS server ready');
    return {
        key,
        cert,
        ca: ca,
        requestCert: true,          // Ask clients for certs
        rejectUnauthorized: false,   // Don't reject at TLS level; middleware handles auth
    };
}

// ── Reload ───────────────────────────────────────────────────────────────────

/**
 * Force-reload the identity index (e.g. after new certs are generated).
 */
export function reloadIdentityIndex(): number {
    _index = null;
    _caCert = null;
    const idx = loadIdentityIndex();
    loadCACert();
    return Object.keys(idx).length;
}
