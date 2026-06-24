import * as fs from 'fs';
import * as path from 'path';

export interface ExecutionResult {
  success: boolean;
  capabilityId: string;
  outputPathJson?: string;
  outputPathCss?: string;
  tokensCount?: number;
  error?: string;
}

// Robust root detection
function getRootDir(): string {
  if (fs.existsSync('/app/creative-liberation-engine')) {
    return '/app/creative-liberation-engine';
  } else if (fs.existsSync('Y:/creative-liberation-engine')) {
    return 'Y:/creative-liberation-engine';
  } else if (fs.existsSync('y:/creative-liberation-engine')) {
    return 'y:/creative-liberation-engine';
  }
  // Fallback to searching upwards from current directory
  let current = __dirname;
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'DESIGN.md')) && fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return path.resolve(__dirname, '../../..');
}

// A robust line-by-line YAML-to-JSON parser in pure TS to avoid package dependency conflicts
export function parseYamlFrontmatter(content: string): any {
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) {
    throw new Error('No frontmatter block found in file');
  }

  const yamlLines = match[1].split('\n');
  const result: any = {};
  const stack: { indent: number; obj: any; key: string | null }[] = [{ indent: -1, obj: result, key: null }];

  for (let line of yamlLines) {
    // Skip comments and empty lines safely without cutting hex color codes (e.g. #0EA5E9)
    let cleanLine = line.trimEnd();
    if (cleanLine.includes(' #')) {
      cleanLine = cleanLine.split(' #')[0].trimEnd();
    } else if (cleanLine.startsWith('#')) {
      cleanLine = '';
    }
    if (!cleanLine.trim()) continue;

    const indent = line.length - line.trimStart().length;
    const colonIndex = cleanLine.indexOf(':');
    if (colonIndex === -1) continue;

    const key = cleanLine.substring(0, colonIndex).trim();
    let val = cleanLine.substring(colonIndex + 1).trim();

    // Unwrap quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }

    // Handle indentation nesting
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const currentParent = stack[stack.length - 1].obj;

    // Check if line represents a block scalar / multiline string
    if (val === '>') {
      // Find following lines with larger indent and compile them
      currentParent[key] = ''; // Will be populated dynamically by next lines if we had complex nesting
      stack.push({ indent, obj: currentParent, key });
      continue;
    }

    if (val === '') {
      // It's a new object category
      const newObj = {};
      currentParent[key] = newObj;
      stack.push({ indent, obj: newObj, key: null });
    } else {
      // Scalar value: parse integers, booleans, or floats where appropriate
      let parsedVal: any = val;
      if (val.toLowerCase() === 'true') parsedVal = true;
      else if (val.toLowerCase() === 'false') parsedVal = false;
      else if (!isNaN(Number(val)) && val !== '') parsedVal = Number(val);

      currentParent[key] = parsedVal;
    }
  }

  return result;
}

export function generateCssVariables(tokens: any): string {
  let css = ':root {\n';

  // 1. Compile Colors
  if (tokens.colors) {
    css += '  /* Color Tokens */\n';
    for (const [key, val] of Object.entries(tokens.colors)) {
      css += `  --color-${key}: ${val};\n`;
    }
  }

  // 2. Compile Typography
  if (tokens.typography) {
    css += '\n  /* Typography Tokens */\n';
    css += `  --font-heading: "${tokens.typography.heading}", sans-serif;\n`;
    css += `  --font-body: "${tokens.typography.body}", sans-serif;\n`;
    css += `  --font-mono: "${tokens.typography.mono}", monospace;\n`;

    if (tokens.typography.scale) {
      for (const [key, val] of Object.entries(tokens.typography.scale)) {
        css += `  --font-size-${key}: ${val}px;\n`;
      }
    }
    if (tokens.typography.weights) {
      for (const [key, val] of Object.entries(tokens.typography.weights)) {
        css += `  --font-weight-${key}: ${val};\n`;
      }
    }
    if (tokens.typography.line_heights) {
      for (const [key, val] of Object.entries(tokens.typography.line_heights)) {
        css += `  --line-height-${key}: ${val};\n`;
      }
    }
  }

  // 3. Compile Spacing
  if (tokens.spacing && tokens.spacing.scale) {
    css += '\n  /* Spacing Tokens */\n';
    css += `  --spacing-unit: ${tokens.spacing.unit}px;\n`;
    for (const [key, val] of Object.entries(tokens.spacing.scale)) {
      css += `  --spacing-${key}: ${val}px;\n`;
    }
  }

  // 4. Compile Radii
  if (tokens.radii) {
    css += '\n  /* Border Radii */\n';
    for (const [key, val] of Object.entries(tokens.radii)) {
      const formattedVal = typeof val === 'number' && val > 0 ? `${val}px` : val;
      css += `  --radius-${key}: ${formattedVal};\n`;
    }
  }

  // 5. Compile Effects (Shadows & Glassmorphism)
  if (tokens.effects) {
    css += '\n  /* Effects */\n';
    if (tokens.effects.glass) {
      css += `  --glass-blur: ${tokens.effects.glass.blur};\n`;
      css += `  --glass-background: ${tokens.effects.glass.background};\n`;
      css += `  --glass-border: ${tokens.effects.glass.border};\n`;
    }
    if (tokens.effects.shadows) {
      for (const [key, val] of Object.entries(tokens.effects.shadows)) {
        css += `  --shadow-${key}: ${val};\n`;
      }
    }
  }

  // 6. Compile Animation Durations
  if (tokens.animation) {
    css += '\n  /* Animation */\n';
    if (tokens.animation.duration) {
      for (const [key, val] of Object.entries(tokens.animation.duration)) {
        css += `  --transition-duration-${key}: ${val};\n`;
      }
    }
    if (tokens.animation.easing) {
      for (const [key, val] of Object.entries(tokens.animation.easing)) {
        css += `  --transition-easing-${key}: ${val};\n`;
      }
    }
  }

  css += '}\n';
  return css;
}

export async function executeCapability(): Promise<ExecutionResult> {
  try {
    const rootDir = getRootDir();
    const designMdPath = path.join(rootDir, 'DESIGN.md');
    
    if (!fs.existsSync(designMdPath)) {
      return {
        success: false,
        capabilityId: 'IE-IDX-0106',
        error: `DESIGN.md file not found at path: ${designMdPath}`
      };
    }

    const designMdContent = fs.readFileSync(designMdPath, 'utf-8');
    const parsedTokens = parseYamlFrontmatter(designMdContent);
    const cssVariables = generateCssVariables(parsedTokens);

    // Dynamic output targeting
    const layoutsDir = path.join(rootDir, 'runtime/layouts');
    if (!fs.existsSync(layoutsDir)) {
      fs.mkdirSync(layoutsDir, { recursive: true });
    }

    const outputPathJson = path.join(layoutsDir, 'design-tokens.json');
    const outputPathCss = path.join(layoutsDir, 'cle-variables.css');

    // Write token compilation
    fs.writeFileSync(outputPathJson, JSON.stringify(parsedTokens, null, 2), 'utf-8');
    fs.writeFileSync(outputPathCss, cssVariables, 'utf-8');

    // Count compiled attributes recursively
    const countKeys = (obj: any): number => {
      let count = 0;
      for (const k in obj) {
        if (typeof obj[k] === 'object' && obj[k] !== null) {
          count += countKeys(obj[k]);
        } else {
          count++;
        }
      }
      return count;
    };

    return {
      success: true,
      capabilityId: 'IE-IDX-0106',
      outputPathJson,
      outputPathCss,
      tokensCount: countKeys(parsedTokens)
    };
  } catch (err: any) {
    return {
      success: false,
      capabilityId: 'IE-IDX-0106',
      error: err?.message || String(err)
    };
  }
}

import { fileURLToPath } from 'url';

// Self-execute if executed directly from terminal
const nodePath = process.argv[1];
if (nodePath && fs.existsSync(nodePath) && fs.realpathSync(nodePath) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  executeCapability().then(res => {
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.success ? 0 : 1);
  });
}
