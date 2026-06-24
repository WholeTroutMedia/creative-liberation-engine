import { describe, it, expect } from 'vitest';
import { executeCapability } from './index.js';

describe('IE-IDX-0213_all-the-news-from-the-google-io-2026-dev Validation', () => {
  it('should successfully execute the capability and return success', async () => {
    const result = await executeCapability();
    expect(result.success).toBe(true);
    expect(result.capabilityId).toBe('IE-IDX-0213_all-the-news-from-the-google-io-2026-dev');
  });
});
