import * as fs from 'fs';
import * as path from 'path';

export interface CompiledThread {
  title: string;
  sourceUrl?: string;
  author: string;
  timestamp: string;
  sections: { header: string; content: string }[];
  extractedTags: string[];
}

export interface ExecutionResult {
  success: boolean;
  capabilityId: string;
  compiledThread?: CompiledThread;
  error?: string;
}

export class ThreadsCompiler {
  public parseMarkdownThread(mdContent: string): CompiledThread {
    const lines = mdContent.split('\n');
    let title = 'Untitled Thread';
    let author = 'Anonymous';
    let sourceUrl = '';
    const sections: { header: string; content: string }[] = [];
    const extractedTags: string[] = [];

    let currentSection: { header: string; content: string } | null = null;

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Extract metadata
      if (trimmed.startsWith('# ')) {
        title = trimmed.substring(2);
      } else if (trimmed.toLowerCase().startsWith('author:')) {
        author = trimmed.substring(7).trim();
      } else if (trimmed.toLowerCase().startsWith('source:')) {
        sourceUrl = trimmed.substring(7).trim();
      } else if (trimmed.startsWith('## ')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          header: trimmed.substring(3),
          content: ''
        };
      } else if (trimmed.startsWith('#')) {
        // Tag parsing (e.g. #design #visual)
        const tags = trimmed.match(/#[a-zA-Z0-9\-]+/g);
        if (tags) {
          tags.forEach(t => extractedTags.push(t.substring(1)));
        }
      } else {
        if (currentSection) {
          currentSection.content += (currentSection.content ? '\n' : '') + trimmed;
        } else {
          // Append to a default introduction section
          if (sections.length === 0) {
            sections.push({ header: 'Introduction', content: trimmed });
          } else {
            sections[0].content += '\n' + trimmed;
          }
        }
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return {
      title,
      author,
      sourceUrl: sourceUrl || undefined,
      timestamp: new Date().toISOString(),
      sections,
      extractedTags: Array.from(new Set(extractedTags))
    };
  }
}

export async function executeCapability(payload?: {
  mdContent?: string;
  filePath?: string;
}): Promise<ExecutionResult> {
  try {
    const compiler = new ThreadsCompiler();
    let content = payload?.mdContent || '';

    if (payload?.filePath) {
      if (fs.existsSync(payload.filePath)) {
        content = fs.readFileSync(payload.filePath, 'utf-8');
      } else {
        return {
          success: false,
          capabilityId: 'IE-IDX-0107',
          error: `File not found at path: ${payload.filePath}`
        };
      }
    }

    if (!content) {
      // Default: parse a simulated thread post
      content = `# Mangto Threads Design
Author: Mangto
Source: https://threads.net/mangto/post/123
#visual #design-systems #glassmorphism

## Introduction
Detailing the visual DESIGN.md spec for V6 layout interfaces.

## Colors & Easing
Defaulting dark HSL variables with 200ms spring physics curves.`;
    }

    const compiledThread = compiler.parseMarkdownThread(content);
    return {
      success: true,
      capabilityId: 'IE-IDX-0107',
      compiledThread
    };
  } catch (err: any) {
    return {
      success: false,
      capabilityId: 'IE-IDX-0107',
      error: err?.message || String(err)
    };
  }
}

// Self-execute if executed directly from terminal
import { fileURLToPath } from 'url';
const nodePath = process.argv[1];
if (nodePath && fs.existsSync(nodePath) && fs.realpathSync(nodePath) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  executeCapability().then(res => {
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.success ? 0 : 1);
  });
}
