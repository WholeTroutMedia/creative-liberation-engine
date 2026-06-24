import { describe, it, expect } from 'vitest';
import { executeCapability, parseYamlFrontmatter, generateCssVariables } from './index.js';
import * as fs from 'fs';
import * as path from 'path';

describe('IE-IDX-0106 - Refero Styles & Design Sync', () => {
  it('should parse YAML frontmatter correctly', () => {
    const mockContent = `---\ncolors:\n  primary: "#0EA5E9"\n  accent: "#8B5CF6"\n---\n# Comments\nBody`;
    const tokens = parseYamlFrontmatter(mockContent);
    expect(tokens.colors.primary).toBe('#0EA5E9');
    expect(tokens.colors.accent).toBe('#8B5CF6');
  });

  it('should compile CSS variables correctly', () => {
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
    expect(css).toContain('--color-primary: #0EA5E9;');
    expect(css).toContain('--font-heading: "Inter", sans-serif;');
    expect(css).toContain('--font-size-base: 16px;');
  });

  it('should compile real DESIGN.md into runtime outputs', async () => {
    const result = await executeCapability();
    expect(result.success).toBe(true);
    expect(result.capabilityId).toBe('IE-IDX-0106');
    expect(result.outputPathJson).toBeDefined();
    expect(result.outputPathCss).toBeDefined();
    expect(result.tokensCount).toBeGreaterThan(0);

    // Verify files exist
    expect(fs.existsSync(result.outputPathJson!)).toBe(true);
    expect(fs.existsSync(result.outputPathCss!)).toBe(true);

    const compiledJson = JSON.parse(fs.readFileSync(result.outputPathJson!, 'utf-8'));
    expect(compiledJson.design_system.name).toBe('Creative Liberation Engine');
  });
});
