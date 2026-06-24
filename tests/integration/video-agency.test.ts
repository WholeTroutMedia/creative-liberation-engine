import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from 'http';
import { app } from '../../services/video-agency/src/index';

describe('WS-08 — Twelve Labs Semantic Video Indexing Proxy', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(() => {
        return new Promise<void>((resolve) => {
            server = app.listen(0, () => {
                const address = server.address();
                const port = typeof address === 'string' ? 0 : address?.port || 0;
                baseUrl = `http://localhost:${port}`;
                console.log(`[test] Temp video-agency server listening on port ${port}`);
                resolve();
            });
        });
    });

    afterAll(() => {
        return new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });
    });

    it('health endpoint responds with mode info', async () => {
        const res = await fetch(`${baseUrl}/health`);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.status).toBeDefined();
        expect(data.twelve_labs).toBeDefined();
        expect(data.twelve_labs.mode).toBe('mock'); // Running under mock/sandbox
    });

    it('creates an index successfully', async () => {
        const res = await fetch(`${baseUrl}/api/v1/video/indexes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                indexName: 'Commercial-Site-Walkthroughs'
            })
        });
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.index_id).toBeDefined();
        expect(data.index_name).toBe('Commercial-Site-Walkthroughs');
    });

    it('creates an upload task successfully', async () => {
        const res = await fetch(`${baseUrl}/api/v1/video/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                indexId: 'mock-index-123',
                videoUrl: 'https://example.com/site-walk.mp4'
            })
        });
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.task_id).toBeDefined();
        expect(data.status).toBe('queued');
    });

    it('retrieves task status successfully', async () => {
        const res = await fetch(`${baseUrl}/api/v1/video/tasks/mock-task-456`);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.task_id).toBe('mock-task-456');
        expect(data.status).toBe('ready');
        expect(data.progress).toBe(100);
    });

    it('performs semantic search and returns correct spatial coordinates / timecode segments', async () => {
        // Test conduit search
        const resConduit = await fetch(`${baseUrl}/api/v1/video/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                indexId: 'mock-index-123',
                query: 'electrical conduit'
            })
        });
        expect(resConduit.status).toBe(200);
        const dataConduit = await resConduit.json() as any;
        expect(dataConduit.matches.length).toBe(1);
        expect(dataConduit.matches[0].metadata.element).toBe('Electrical Conduit');
        expect(dataConduit.matches[0].start).toBe(64.2);

        // Test safety / PPE search
        const resSafety = await fetch(`${baseUrl}/api/v1/video/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                indexId: 'mock-index-123',
                query: 'hardhat safety'
            })
        });
        expect(resSafety.status).toBe(200);
        const dataSafety = await resSafety.json() as any;
        expect(dataSafety.matches[0].metadata.event).toBe('PPE Verification Match');
        expect(dataSafety.matches[0].confidence).toBe('high');
    });

    it('generates chapters and summaries successfully', async () => {
        const res = await fetch(`${baseUrl}/api/v1/video/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoId: 'mock-video-999',
                type: 'summary'
            })
        });
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.type).toBe('summary');
        expect(data.summary).toContain('360-degree walkthrough');
    });
});
