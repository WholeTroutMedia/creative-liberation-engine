import type { Request, Response, NextFunction } from 'express';

/**
 * Bearer token authentication for the public dispatch gateway.
 *
 * Reads DISPATCH_API_KEY from env. If the env var is absent, auth is
 * disabled (LAN-only mode) and all requests pass through. This preserves
 * backwards-compatible LAN operation while enabling the public Cloudflare
 * tunnel to enforce auth.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.DISPATCH_API_KEY;

  // Auth disabled — LAN-only operation
  if (!apiKey) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  const token = header.slice(7);
  if (token !== apiKey) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
