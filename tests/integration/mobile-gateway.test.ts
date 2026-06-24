import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('WS-04 — CLE Mobile Gateway Split-Compute & Offline Sync', () => {
    let server: Server;
    let baseUrl: string;
    const testDbPath = path.join(projectRoot, 'runtime/session/mobile_gateway_test.db');

    beforeAll(async () => {
        // Configure temporary test database and offline environments
        process.env.DATABASE_PATH = testDbPath;
        process.env.NODE_ENV = 'test';
        
        // Clean up previous test DB
        if (fs.existsSync(testDbPath)) {
            try {
                fs.rmSync(testDbPath, { force: true });
            } catch (e) {}
        }

        // Dynamically import the Express app to ensure it evaluates with the correct test DATABASE_PATH
        const { app } = await import('../../services/mobile-gateway/src/server');

        return new Promise<void>((resolve) => {
            server = app.listen(0, () => {
                const address = server.address();
                const port = typeof address === 'string' ? 0 : address?.port || 0;
                baseUrl = `http://localhost:${port}`;
                console.log(`[test] Temp mobile-gateway server listening on port ${port}`);
                resolve();
            });
        });
    });

    afterAll(() => {
        return new Promise<void>((resolve) => {
            server.close(() => {
                // Clean up database files safely
                try {
                    if (fs.existsSync(testDbPath)) {
                        fs.rmSync(testDbPath, { force: true });
                    }
                    const walFile = `${testDbPath}-wal`;
                    const shmFile = `${testDbPath}-shm`;
                    if (fs.existsSync(walFile)) fs.rmSync(walFile, { force: true });
                    if (fs.existsSync(shmFile)) fs.rmSync(shmFile, { force: true });
                } catch (e) {
                    // Ignore locks
                }
                resolve();
            });
        });
    });

    it('health endpoint responds with database telemetry statistics', async () => {
        const res = await fetch(`${baseUrl}/health`);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.status).toBe('operational');
        expect(data.service).toBe('mobile-gateway');
        expect(data.db_transactions).toBeDefined();
        expect(data.db_transactions.count).toBe(0);
    });

    it('serves dynamic edge offloading thresholds and routing plans', async () => {
        const res = await fetch(`${baseUrl}/api/mobile/routing`);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.client_model).toBeDefined();
        expect(data.thresholds.ane_thermal_limit).toBeDefined();
        expect(data.routing_rules.length).toBeGreaterThan(0);
    });

    it('buffers offline transactions to SQLite queue and begins asynchronous sync player', async () => {
        const syncPayload = {
            clientId: 'iphone-15-pro-max-test',
            transactions: [
                {
                    id: 'tx-offline-01',
                    action: 'start_task',
                    payload: { task_name: 'Inspect Level 2 Conduit' },
                    timestamp: Date.now()
                },
                {
                    id: 'tx-offline-02',
                    action: 'log_sensory',
                    payload: { event: 'Conduit visually drywalled' },
                    timestamp: Date.now() + 1000
                }
            ]
        };

        const res = await fetch(`${baseUrl}/api/mobile/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncPayload)
        });

        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.success).toBe(true);
        expect(data.message).toContain('Queue buffered successfully');

        // Check health endpoint displays items are now recorded in SQLite transaction ledger
        const resHealth = await fetch(`${baseUrl}/health`);
        const dataHealth = await resHealth.json() as any;
        expect(dataHealth.db_transactions.count).toBe(2);
    });

    it('handles manual sync retry request triggers for failed operations', async () => {
        const retryPayload = {
            clientId: 'iphone-15-pro-max-test'
        };

        const res = await fetch(`${baseUrl}/api/mobile/sync/retry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(retryPayload)
        });

        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.success).toBe(true);
        expect(data.message).toBeDefined();
    });

    it('caches and registers diagnostics on wellness reports', async () => {
        const report = {
            clientId: 'iphone-15-pro-max-test',
            batteryLevel: 0.92,
            aneTemp: 41.5,
            allocatedMemory: 512.4,
            latencyMs: 12.0
        };

        const res = await fetch(`${baseUrl}/api/wellness/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(report)
        });

        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.success).toBe(true);
        expect(data.cached).toBe(true);
    });
});
