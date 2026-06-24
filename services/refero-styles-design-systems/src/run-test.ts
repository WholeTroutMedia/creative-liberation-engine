import { executeCapability, parseYamlFrontmatter, generateCssVariables } from './index.ts';
import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
  console.log('=== IE-IDX-0106 - REFERO STYLES RUNTIME TESTS ===\n');

  try {
    // Test 1: Parse Yaml Frontmatter
    console.log('[TEST 1] Testing parseYamlFrontmatter...');
    const mockContent = `---\ncolors:\n  primary: "#0EA5E9"\n  accent: "#8B5CF6"\n---\n# Comments\nBody`;
    const tokens = parseYamlFrontmatter(mockContent);
    console.log('[DEBUG TOKENS]:', JSON.stringify(tokens, null, 2));
    if (tokens.colors && tokens.colors.primary === '#0EA5E9' && tokens.colors.accent === '#8B5CF6') {
      console.log('✔ parseYamlFrontmatter PASSED!');
    } else {
      throw new Error(`parseYamlFrontmatter returned incorrect values: ${JSON.stringify(tokens)}`);
    }

    // Test 2: Generate CSS Variables
    console.log('[TEST 2] Testing generateCssVariables...');
    const mockTokens = {
      colors: {
        primary: '#0EA5E9',
        accent: '#8B5CF6'
      },
      typography: {
        heading: 'Inter',
        body: 'Inter',
        mono: 'JetBrains Mono',
        scale: {
          base: 16
        }
      }
    };
    const css = generateCssVariables(mockTokens);
    if (css.includes('--color-primary: #0EA5E9;') && css.includes('--font-heading: "Inter", sans-serif;')) {
      console.log('✔ generateCssVariables PASSED!');
    } else {
      throw new Error('generateCssVariables did not contain expected variable declarations');
    }

    // Test 3: Execute Capability
    console.log('[TEST 3] Testing executeCapability dynamic file generation...');
    const result = await executeCapability();
    if (result.success && result.outputPathJson && result.outputPathCss && result.tokensCount && result.tokensCount > 0) {
      console.log('✔ executeCapability PASSED!');
      console.log(`  JSON Path: ${result.outputPathJson}`);
      console.log(`  CSS Path: ${result.outputPathCss}`);
      console.log(`  Tokens Compiled: ${result.tokensCount}`);
    } else {
      throw new Error(`executeCapability failed: ${result.error}`);
    }

    console.log('\n✔ ALL TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err?.message || String(err));
    process.exit(1);
  }
}

runTests();
