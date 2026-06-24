import { executeCapability, ThreadsCompiler } from './index.ts';
import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
  console.log('=== IE-IDX-0107 - THREADS PARSER RUNTIME TESTS ===\n');

  try {
    const compiler = new ThreadsCompiler();
    
    // Test 1: Parse Markdown Content
    console.log('[TEST 1] Testing markdown threads compilation...');
    const mockContent = `# Design System Rollout\nAuthor: Nicholas\nSource: https://threads.net/nicholas/post/1\n#sovereignty #artist\n\n## Section One\nThis is a detail.\n\n## Section Two\nThis is another detail.`;
    const thread = compiler.parseMarkdownThread(mockContent);
    
    console.log('✔ Markdown parsed successfully!');
    console.log(`  Title: ${thread.title}`);
    console.log(`  Author: ${thread.author}`);
    console.log(`  Sections Parsed: ${thread.sections.length}`);
    console.log(`  Tags Extracted: ${thread.extractedTags.join(', ')}`);
    
    if (thread.title !== 'Design System Rollout' || thread.author !== 'Nicholas' || !thread.extractedTags.includes('sovereignty')) {
      throw new Error('Parsed thread returned invalid metadata');
    }

    // Test 2: executeCapability Integration
    console.log('\n[TEST 2] Testing executeCapability interface...');
    const result = await executeCapability({ mdContent: mockContent });
    
    if (result.success && result.compiledThread) {
      console.log('✔ executeCapability dynamic compile PASSED!');
    } else {
      throw new Error(`executeCapability failed: ${result.error}`);
    }

    console.log('\n✔ ALL THREADS COMPILER TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err?.message || String(err));
    process.exit(1);
  }
}

runTests();
