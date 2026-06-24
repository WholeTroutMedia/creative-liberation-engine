import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('WS-03 — Sovereign Qdrant Memory Spine & Cosine Similarity Fallback', () => {
    let server: Server;
    let baseUrl: string;
    const testDbDir = path.join(projectRoot, 'services/averi-memory-service/data');
    const testDbPath = path.join(testDbDir, 'memory.db');

    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        process.env.QDRANT_MOCK = 'true'; // Force offline SQLite fallback mode for tests

        // Clean up previous test database
        if (fs.existsSync(testDbPath)) {
            try {
                fs.rmSync(testDbPath, { force: true });
            } catch (e) {}
        }

        // Dynamically import the Express app to ensure it evaluates with test environment variables
        const { app } = await import('../../services/averi-memory-service/src/index');

        return new Promise<void>((resolve) => {
            server = app.listen(0, () => {
                const address = server.address();
                const port = typeof address === 'string' ? 0 : address?.port || 0;
                baseUrl = `http://localhost:${port}`;
                console.log(`[test] Temp averi-memory-service server listening on port ${port}`);
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
                } catch (e) {}
                resolve();
            });
        });
    });

    it('health endpoint responds and vector engine is active', async () => {
        const res = await fetch(`${baseUrl}/health`);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.status).toBe('online');
        expect(data.service).toBe('averi-memory-service');
        expect(data.database).toBeDefined();
    });

    it('successfully initializes a vector collection index', async () => {
        const res = await fetch(`${baseUrl}/api/vectors/indexes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                collection: 'contech-site-telemetry',
                vectorSize: 3 // Small dimensions for simple manual calculation verification
            })
        });

        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.success).toBe(true);
        expect(data.collection).toBe('contech-site-telemetry');
    });

    it('stores and indexes vector points under SQLite fallback', async () => {
        // 1. Insert Vector A (Conduit) - [0.1, 0.2, 0.3]
        const resA = await fetch(`${baseUrl}/api/vectors/insert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vectorId: 'vec-conduit-01',
                docId: 'doc-conduit-123',
                collection: 'contech-site-telemetry',
                vector: [0.1, 0.2, 0.3],
                payload: { element: 'Electrical Conduit', level: 2 }
            })
        });
        expect(resA.status).toBe(200);
        const dataA = await resA.json() as any;
        expect(dataA.success).toBe(true);

        // 2. Insert Vector B (Drywall) - [0.9, 0.8, 0.7]
        const resB = await fetch(`${baseUrl}/api/vectors/insert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vectorId: 'vec-drywall-01',
                docId: 'doc-drywall-456',
                collection: 'contech-site-telemetry',
                vector: [0.9, 0.8, 0.7],
                payload: { element: 'Drywall Partition', level: 3 }
            })
        });
        expect(resB.status).toBe(200);
        const dataB = await resB.json() as any;
        expect(dataB.success).toBe(true);
    });

    it('performs mathematically precise cosine similarity search over offline vectors', async () => {
        // Query Vector C: [0.11, 0.19, 0.29] (Very similar to Vector A, highly dissimilar to Vector B)
        const res = await fetch(`${baseUrl}/api/vectors/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                collection: 'contech-site-telemetry',
                queryVector: [0.11, 0.19, 0.29],
                limit: 2
            })
        });

        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.collection).toBe('contech-site-telemetry');
        
        // Assert matches order and score thresholds
        const results = data.results;
        expect(results.length).toBe(2);

        // Vector A (Conduit) should have high cosine similarity (接近 1.0) and be first
        expect(results[0].id).toBe('vec-conduit-01');
        expect(results[0].score).toBeGreaterThan(0.99); // Dot product should yield excellent match
        expect(results[0].payload.element).toBe('Electrical Conduit');
        expect(results[0].source).toBe('sqlite_fallback');

        // Vector B (Drywall) should have a significantly lower score and be second
        expect(results[1].id).toBe('vec-drywall-01');
        expect(results[1].score).toBeLessThan(0.95);
    });
});
