import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from './index.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

describe('averi-memory-service Context Caching API', () => {
  const dbPath = path.resolve('./data/memory.db');

  beforeEach(() => {
    // Ensure table exists and clear it before each test
    const db = new Database(dbPath);
    db.exec('DELETE FROM context_cache');
    db.close();
  });

  it('registers a new context cache (cache miss)', async () => {
    const payload = {
      key: 'test-cache-key-1',
      content: 'This is a long test context that should be cached to minimize token burn.',
      model: 'models/gemini-2.5-flash',
      ttlSeconds: 60
    };

    const res = await request(app)
      .post('/api/context-cache/register')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.cacheName).toBeDefined();
    expect(res.body.cacheName).toContain('cachedContents/');
    expect(res.body.hit).toBe(false);
    expect(res.body.tokens).toBeGreaterThan(0);
  });

  it('returns cached context on duplicate registration (cache hit)', async () => {
    const payload = {
      key: 'test-cache-key-2',
      content: 'Identical context content for hit checking.',
      model: 'models/gemini-2.5-flash',
      ttlSeconds: 100
    };

    // First register (miss)
    const res1 = await request(app)
      .post('/api/context-cache/register')
      .send(payload);
    expect(res1.body.hit).toBe(false);

    // Second register (hit)
    const res2 = await request(app)
      .post('/api/context-cache/register')
      .send(payload);
    expect(res2.status).toBe(200);
    expect(res2.body.cacheName).toBe(res1.body.cacheName);
    expect(res2.body.hit).toBe(true);
  });

  it('retrieves cached context details by key', async () => {
    const payload = {
      key: 'test-cache-key-3',
      content: 'Retrieve me by key please.',
      model: 'models/gemini-2.5-flash',
      ttlSeconds: 120
    };

    await request(app)
      .post('/api/context-cache/register')
      .send(payload);

    const res = await request(app).get('/api/context-cache/test-cache-key-3');
    if (res.status !== 200) console.error('GET ERROR:', res.body);
    expect(res.status).toBe(200);
    expect(res.body.cache_key).toBe('test-cache-key-3');
    expect(res.body.gemini_cache_name).toBeDefined();
  });

  it('deletes/evicts a cache entry manually', async () => {
    const payload = {
      key: 'test-cache-key-4',
      content: 'Evict me please.',
      model: 'models/gemini-2.5-flash',
      ttlSeconds: 120
    };

    await request(app)
      .post('/api/context-cache/register')
      .send(payload);

    const deleteRes = await request(app).delete('/api/context-cache/test-cache-key-4');
    if (deleteRes.status !== 200) console.error('DELETE ERROR:', deleteRes.body);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
    expect(deleteRes.body.changes).toBe(1);

    const getRes = await request(app).get('/api/context-cache/test-cache-key-4');
    expect(getRes.status).toBe(404);
  });
});
