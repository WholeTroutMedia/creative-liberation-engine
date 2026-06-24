import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from 'http';
import { app } from '../../services/auth-md-hub/src/index';

describe('IE-IDX-0250 — WorkOS auth.md Open Agent Identity Protocol Compliance', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(() => {
    return new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === 'string' ? 0 : address?.port || 0;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('verifies service health', async () => {
    const res = await fetch(`${baseUrl}/api/auth-md/health`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.status).toBe('OK');
    expect(data.service).toBe('auth-md-hub');
  });

  it('discovers auth.md capabilities documentation', async () => {
    const res = await fetch(`${baseUrl}/api/auth-md/discover`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    const md = await res.text();
    expect(md).toContain('Creative Liberation Engine Open Agent Registration Protocol');
  });

  it('registers an agent node using auth.md credentials and receives active access tokens', async () => {
    const res = await fetch(`${baseUrl}/api/auth-md/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sovereign-Watch-Agent',
        manifestUrl: 'https://raw.githubusercontent.com/workos/auth.md/main/agent-manifest.md',
        scopes: ['read:code', 'read:telemetry']
      })
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.message).toBe('Agent registered successfully');
    expect(data.access_token).toBeDefined();
    expect(data.token_type).toBe('Bearer');
  });

  it('verifies issued agent tokens and validates scopes', async () => {
    // Register first to get a token
    const regRes = await fetch(`${baseUrl}/api/auth-md/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sovereign-Watch-Agent',
        manifestUrl: 'https://raw.githubusercontent.com/workos/auth.md/main/agent-manifest.md',
        scopes: ['read:code', 'read:telemetry']
      })
    });
    const regData = await regRes.json() as any;
    const token = regData.access_token;

    const res = await fetch(`${baseUrl}/api/auth-md/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.active).toBe(true);
    expect(data.name).toBe('Sovereign-Watch-Agent');
    expect(data.scopes).toContain('read:code');
  });
});
