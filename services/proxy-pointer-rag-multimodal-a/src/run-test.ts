import { executeCapability, ProxyPointerRegistry } from './index.ts';
import * as fs from 'fs';
import * as path from 'path';

// Robust root detection
function getRootDir(): string {
  if (fs.existsSync('/app/creative-liberation-engine')) return '/app/creative-liberation-engine';
  if (fs.existsSync('Y:/creative-liberation-engine')) return 'Y:/creative-liberation-engine';
  if (fs.existsSync('y:/creative-liberation-engine')) return 'y:/creative-liberation-engine';
  return path.resolve(__dirname, '../../..');
}

async function runTests() {
  console.log('=== IE-IDX-0113 - PROXY-POINTER RAG RUNTIME TESTS ===\n');

  try {
    const rootDir = getRootDir();
    const testFile = path.join(rootDir, 'DESIGN.md');
    
    if (!fs.existsSync(testFile)) {
      throw new Error(`Test file DESIGN.md missing at ${testFile}`);
    }

    const registry = new ProxyPointerRegistry();
    
    // Test 1: Register Pointer
    console.log('[TEST 1] Registering pointer for DESIGN.md...');
    const ptr = registry.registerPointer(testFile, ['sovereignty', 'aesthetics']);
    console.log('✔ Pointer registered successfully!');
    console.log(`  ID: ${ptr.id}`);
    console.log(`  Filename: ${ptr.filename}`);
    console.log(`  Size: ${ptr.sizeBytes} bytes`);
    console.log(`  Tags: ${ptr.tags.join(', ')}`);
    
    if (ptr.filename !== 'DESIGN.md' || !ptr.tags.includes('sovereignty')) {
      throw new Error('Pointer registration returned invalid metadata');
    }

    // Test 2: Search Pointer
    console.log('\n[TEST 2] Searching registry for query "sovereignty"...');
    const results = registry.searchPointers('sovereignty');
    console.log(`✔ Search matched ${results.length} pointers.`);
    
    if (results.length === 0 || results[0].id !== ptr.id) {
      throw new Error('Search failed to locate the registered pointer');
    }

    // Test 3: executeCapability Integration
    console.log('\n[TEST 3] Testing executeCapability dynamic interface...');
    const runResult = await executeCapability({
      action: 'search',
      query: 'aesthetics'
    });
    
    if (runResult.success && runResult.results && runResult.results.length > 0) {
      console.log('✔ executeCapability search successfully integrated!');
      console.log(`  Pointers matching aesthetics: ${runResult.results.length}`);
    } else {
      throw new Error(`executeCapability failed: ${runResult.error}`);
    }

    console.log('\n✔ ALL PROXY-POINTER RAG TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err?.message || String(err));
    process.exit(1);
  }
}

runTests();
