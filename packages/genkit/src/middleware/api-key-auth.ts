/**
 * Creative Liberation Engine â€” API Key Auth Middleware
 *
 * Secures the Genkit Express server against unauthorized access.
 * Checks for a valid x-api-key header or bearer token matching GENKIT_API_KEY.
 * Allows unauthenticated access to health and metrics endpoints.
 *
 * Constitutional: Article II (Sovereignty) â€” secure public endpoints
 */

import type { Request, Response, NextFunction } from 'express';

/** Paths that skip API key checks (health probes, metrics). Use prefix match via startsWith. */
const PUBLIC_PATHS = [
    '/health',
    '/stats',
    '/audit',
    '/averiChat/health',
    '/api/mesh/health',
    '/api/model-fleet/status',
];

function normalizeClientIp(ip?: string): string {
    if (!ip) return '';
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    return ip;
}

function clientIp(req: Request): string {
    const raw =
        req.ip ||
        req.socket?.remoteAddress ||
        (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress;
    return typeof raw === 'string' ? raw : '';
}

function isPrivateNetworkIp(ip?: string): boolean {
    const n = normalizeClientIp(ip);
    if (!n) return false;
    if (n === '127.0.0.1' || n === '::1') return true;
    if (n.startsWith('10.')) return true;
    if (n.startsWith('192.168.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(n)) return true;
    return false;
}

export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
    // 1. Allow public endpoints
    if (PUBLIC_PATHS.some((path) => req.path.startsWith(path))) {
        return next();
    }

    // 2. Allow local/private-network execution bypass by default.
    // Set GENKIT_ALLOW_PRIVATE_LOCAL_BYPASS=false to enforce key checks everywhere.
    const allowPrivateBypass = process.env.GENKIT_ALLOW_PRIVATE_LOCAL_BYPASS !== 'false';
    const ip = clientIp(req);
    if (allowPrivateBypass && isPrivateNetworkIp(ip)) {
        return next();
    }

    // 2b. Optional NAS/internal-network bypass for container-to-container calls.
    if (process.env.GENKIT_TRUST_PRIVATE_NETWORK === 'true' && isPrivateNetworkIp(ip)) {
        return next();
    }

    // 3. Extract key from header
    const apiKey = process.env.GENKIT_API_KEY;
    if (!apiKey) {
        // If no key is configured in the environment, we must fail closed to prevent
        // accidental public exposure of an unconfigured server.
        console.warn('[AUTH] WARNING: GENKIT_API_KEY is not set. Rejecting request.');
        return res.status(500).json({ error: 'Server authentication improperly configured' });
    }

    const providedKeyRaw = req.headers['x-api-key'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const providedKey = typeof providedKeyRaw === 'string' ? providedKeyRaw.trim() : '';
    const expectedKey = apiKey.trim();

    if (!providedKey || providedKey !== expectedKey) {
        const privateNet = isPrivateNetworkIp(ip);
        const providedLen = typeof providedKey === 'string' ? providedKey.length : 0;
        console.warn(`[AUTH] Unauthorized access attempt to ${req.path} from ${ip || 'unknown'} | private=${privateNet} trust_private=${process.env.GENKIT_TRUST_PRIVATE_NETWORK} provided_len=${providedLen} expected_len=${expectedKey.length}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    }

    next();
};
