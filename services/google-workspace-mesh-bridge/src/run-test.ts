import { executeCapability } from './index.ts';
import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
  console.log('=== IE-IDX-0276 - GOOGLE WORKSPACE BRIDGE RUNTIME TESTS ===\n');

  try {
    console.log('[TEST 1] Querying workspace proxy bridge health check...');
    const result = await executeCapability({ action: 'health' });
    
    if (result.success && result.proxyTarget) {
      console.log('✔ executeCapability health check PASSED!');
      console.log(`  Proxy Upstream Target: ${result.proxyTarget}`);
      console.log(`  Upstream Status: ${result.isUpstreamOnline ? 'ONLINE' : 'OFFLINE (Sleep Mode)'}`);
      console.log(`  Details: ${result.details}`);
    } else {
      throw new Error(`executeCapability health failed: ${result.error}`);
    }

    console.log('\n✔ ALL WORKSPACE BRIDGE TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err?.message || String(err));
    process.exit(1);
  }
}

runTests();
