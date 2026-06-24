import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LocalBundleManager, createBundle } from '../src/transport/bundle';

describe('BPv7 Bundle Protocol (HDTN)', () => {
  const testWorkspace = path.join(__dirname, '.test_workspace');
  let manager: LocalBundleManager;

  beforeEach(async () => {
    manager = new LocalBundleManager(testWorkspace);
    // Cleanup any lingering test files
    await fs.rm(testWorkspace, { recursive: true, force: true }).catch(() => {});
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true }).catch(() => {});
  });

  it('should create a valid BPv7 bundle', () => {
    const bundle = createBundle({
      sourceEid: 'hive://KADE',
      destinationEid: 'mcp://dispatch',
      payloadType: 'handoff_state',
      payloadContent: '{"phase": "SHIP"}',
      gitCommitHash: 'abcdef123',
    });

    expect(bundle.primary.version).toBe(7);
    expect(bundle.primary.sourceEid).toBe('hive://KADE');
    expect(bundle.payload.type).toBe('handoff_state');
    expect(bundle.extension?.gitCommitHash).toBe('abcdef123');
  });

  it('should accept custody and save bundle to disk', async () => {
    const bundle = createBundle({
      sourceEid: 'hive://TEST',
      destinationEid: 'mcp://null',
      payloadType: 'script_output',
      payloadContent: 'Test output',
    });

    const filepath = await manager.acceptCustody(bundle);
    const stats = await fs.stat(filepath);
    expect(stats.isFile()).toBe(true);

    const pending = await manager.listBundles();
    expect(pending.length).toBe(1);
    expect(pending[0]).toContain(bundle.primary.deliveryRegistrationId);
  });

  it('should correctly serialize and deserialize (Egress router simulation)', async () => {
    const initialBundle = createBundle({
      sourceEid: 'hive://TEST',
      destinationEid: 'mcp://null',
      payloadType: 'telemetry',
      payloadContent: 'System online',
      knowledgeSubgraph: [{ id: '123', fact: 'test' }]
    });

    const filepath = await manager.acceptCustody(initialBundle);
    
    // Egress router reads
    const readBack = await manager.readBundle(filepath);
    expect(readBack.primary.deliveryRegistrationId).toBe(initialBundle.primary.deliveryRegistrationId);
    expect(readBack.extension?.knowledgeSubgraph?.[0]?.fact).toBe('test');

    // Egress router releases
    await manager.releaseCustody(filepath);
    
    const pending = await manager.listBundles();
    expect(pending.length).toBe(0);
  });
});
