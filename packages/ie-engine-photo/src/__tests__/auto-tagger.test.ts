import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { autoTagImage, autoTagBatch, VisionTagSchema } from '../auto-tagger.js';

const FIXTURES_DIR = path.join(__dirname, '__fixtures__');
const FIXTURE_IMG = path.join(FIXTURES_DIR, 'test-portrait.jpg');

beforeEach(() => {
  if (!fs.existsSync(FIXTURES_DIR)) fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  // Minimal valid JPEG header (2x2 pixel)
  const jpegBytes = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  fs.writeFileSync(FIXTURE_IMG, jpegBytes);
});

afterEach(() => {
  if (fs.existsSync(FIXTURE_IMG)) fs.unlinkSync(FIXTURE_IMG);
  if (fs.existsSync(FIXTURES_DIR)) fs.rmdirSync(FIXTURES_DIR);
});

describe('VisionTagSchema', () => {
  it('validates a well-formed tag object', () => {
    const valid = {
      subject: ['portrait', 'person'],
      mood: ['dramatic'],
      style: ['cinematic'],
      colors: ['warm tones', 'amber'],
      technical: ['shallow-dof'],
      composition: ['rule-of-thirds'],
      confidence: 0.92,
    };
    expect(VisionTagSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects confidence outside 0-1', () => {
    const invalid = {
      subject: ['test'], mood: ['test'], style: ['test'],
      colors: ['test'], technical: ['test'], composition: ['test'],
      confidence: 1.5,
    };
    expect(VisionTagSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(VisionTagSchema.safeParse({ subject: ['test'] }).success).toBe(false);
  });
});

describe('autoTagImage() — heuristic fallback', () => {
  it('falls back to heuristics when no API key is set', async () => {
    delete process.env['GOOGLE_AI_API_KEY'];
    delete process.env['GEMINI_API_KEY'];

    const result = await autoTagImage(FIXTURE_IMG);

    expect(result.source).toBe('heuristic-fallback');
    expect(result.imagePath).toBe(FIXTURE_IMG);
    expect(result.tags.confidence).toBeLessThan(0.5);
    expect(result.flatTags.length).toBeGreaterThan(0);
    expect(result.taggedAt).toBeTruthy();
    expect(result.id).toMatch(/^tag-/);
  });

  it('extracts "portrait" from filename heuristics', async () => {
    const result = await autoTagImage(FIXTURE_IMG);
    expect(result.tags.subject).toContain('portrait');
  });

  it('throws for non-existent file', async () => {
    await expect(autoTagImage('/nonexistent/file.jpg')).rejects.toThrow();
  });
});

describe('autoTagImage() — Gemini vision', () => {
  const mockApiKey = 'test-api-key-12345';
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env['GOOGLE_AI_API_KEY'];
  });

  it('calls Gemini API and parses response when API key is set', async () => {
    const mockResponse = {
      subject: ['portrait', 'woman'],
      mood: ['contemplative', 'serene'],
      style: ['editorial', 'natural-light'],
      colors: ['muted earth tones', 'soft shadows'],
      technical: ['shallow-dof', 'medium-format'],
      composition: ['center-weighted', 'negative-space'],
      confidence: 0.88,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: JSON.stringify(mockResponse) }] },
        }],
      }),
    }) as any;

    process.env['GOOGLE_AI_API_KEY'] = mockApiKey;
    const result = await autoTagImage(FIXTURE_IMG);

    expect(result.source).toBe('gemini-vision');
    expect(result.tags.subject).toContain('portrait');
    expect(result.tags.confidence).toBe(0.88);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledOnce();

    const callUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
    expect(callUrl).toContain('gemini-2.0-flash');
    expect(callUrl).toContain(mockApiKey);
  });

  it('falls back to heuristics when API returns error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    }) as any;

    process.env['GOOGLE_AI_API_KEY'] = mockApiKey;
    const result = await autoTagImage(FIXTURE_IMG);

    expect(result.source).toBe('heuristic-fallback');
  });

  it('falls back to heuristics when API returns malformed JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'not json at all' }] } }],
      }),
    }) as any;

    process.env['GOOGLE_AI_API_KEY'] = mockApiKey;
    const result = await autoTagImage(FIXTURE_IMG);

    expect(result.source).toBe('heuristic-fallback');
  });
});

describe('autoTagBatch()', () => {
  it('processes multiple images and returns results', async () => {
    delete process.env['GOOGLE_AI_API_KEY'];
    delete process.env['GEMINI_API_KEY'];

    const img2 = path.join(FIXTURES_DIR, 'landscape-sunset.png');
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    fs.writeFileSync(img2, pngBytes);

    const results = await autoTagBatch([FIXTURE_IMG, img2], { maxConcurrency: 2 });

    expect(results.length).toBe(2);
    expect(results.find(r => r.imagePath === FIXTURE_IMG)).toBeDefined();
    expect(results.find(r => r.imagePath === img2)).toBeDefined();

    const portraitResult = results.find(r => r.imagePath === FIXTURE_IMG)!;
    expect(portraitResult.tags.subject).toContain('portrait');

    const landscapeResult = results.find(r => r.imagePath === img2)!;
    expect(landscapeResult.tags.subject).toContain('landscape');

    fs.unlinkSync(img2);
  });

  it('returns empty array for empty input', async () => {
    const results = await autoTagBatch([]);
    expect(results).toEqual([]);
  });
});
