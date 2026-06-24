import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from 'http';
import { app } from '../../services/physical-twin/src/index';

describe('IE-IDX-0245 — Buildots Physical Twin Progress Integration', () => {
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
    const res = await fetch(`${baseUrl}/api/physical-twin/health`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.status).toBe('OK');
    expect(data.service).toBe('physical-twin');
  });

  it('ingests hardhat 360-degree capture log successfully', async () => {
    const res = await fetch(`${baseUrl}/api/physical-twin/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'hardhat_360' })
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.message).toBe('Capture ingested successfully');
    expect(data.capture.source).toBe('hardhat_360');
  });

  it('compares physical drone/cv takeoff quantities with BIM schedule targets and detects delay risks', async () => {
    const actualQuantities = {
      plumbing_fixtures: 3,
      doors_windows: 4,
      drywall_linear_foot: 150.5
    };

    const res = await fetch(`${baseUrl}/api/physical-twin/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name: 'Sovereign B2B ConTech Operations',
        quantities: actualQuantities
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.status).toBe('DELAY_RISK');
    expect(data.delayProbability).toBe(0.85);
    expect(data.variances.plumbing_fixtures).toBe(-9);
    expect(data.variances.doors_windows).toBe(-4);
    expect(data.variances.drywall_linear_foot).toBe(-170);
    expect(data.metrics.drywallCompletionPercentage).toBe(47);
  });
});
