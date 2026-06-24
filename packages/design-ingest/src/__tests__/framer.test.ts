import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasExtractor } from '../framer.js';

// Mock child_process and fs
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  },
}));

import * as childProcess from 'child_process';
import fs from 'fs';

describe('CanvasExtractor', () => {
  let extractor: CanvasExtractor;

  beforeEach(() => {
    extractor = new CanvasExtractor();
    vi.clearAllMocks();
  });

  it('creates output directory if it does not exist', async () => {
    (fs.existsSync as any).mockReturnValue(false);
    const execMock = vi.fn((cmd: string, cb: Function) => cb(null, { stdout: 'done', stderr: '' }));
    (childProcess.exec as any).mockImplementation(execMock);
    
    // Stub walkDir to prevent actual FS reads
    vi.spyOn(extractor as any, 'walkDir').mockReturnValue([]);

    await extractor.extract('https://framer.com/test', '/tmp/framer-out', 'MyComp');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/tmp/framer-out', { recursive: true });
  });

  it('does not create directory if it already exists', async () => {
    (fs.existsSync as any).mockReturnValue(true);
    const execMock = vi.fn((cmd: string, cb: Function) => cb(null, { stdout: 'done', stderr: '' }));
    (childProcess.exec as any).mockImplementation(execMock);
    
    vi.spyOn(extractor as any, 'walkDir').mockReturnValue([]);

    await extractor.extract('https://framer.com/test', '/tmp/exists', 'MyComp');
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('returns success:true and outPath on successful exec', async () => {
    (fs.existsSync as any).mockReturnValue(true);
    const execMock = vi.fn((cmd: string, cb: Function) => cb(null, { stdout: 'extracted!', stderr: '' }));
    (childProcess.exec as any).mockImplementation(execMock);
    
    vi.spyOn(extractor as any, 'walkDir').mockReturnValue([]);

    const result = await extractor.extract('https://framer.com/mycomp', '/tmp/mycomp', 'MyComp');
    expect(result.success).toBe(true);
    expect(result.outPath).toBe('/tmp/mycomp');
    expect(result.error).toBeUndefined();
  });

  it('returns success:false and error message on exec failure', async () => {
    (fs.existsSync as any).mockReturnValue(true);
    const execMock = vi.fn((cmd: string, cb: Function) => cb(new Error('unframer not found'), null));
    (childProcess.exec as any).mockImplementation(execMock);

    const result = await extractor.extract('https://framer.com/bad', '/tmp/bad', 'MyComp');
    expect(result.success).toBe(false);
    expect(result.error).toContain('unframer not found');
  });

  describe('Post-Processing Pipeline', () => {
    it('harmonizes hex colors and font families with design tokens', () => {
      const inputCode = `
        const MyComponent = () => {
          return (
            <div style={{ color: "#ffffff", fontFamily: "Inter", padding: "16px" }}>
              <span style={{ backgroundColor: "#0a0a0f", margin: "24px" }}>Test</span>
            </div>
          );
        }
      `;
      
      const harmonized = (extractor as any).harmonizeStyles(inputCode);
      
      expect(harmonized).toContain("color: 'var(--color-base-neutral-0)'");
      expect(harmonized).toContain("fontFamily: 'var(--font-family-sans)'");
      expect(harmonized).toContain("padding: 'var(--spacing-m)'");
      expect(harmonized).toContain("backgroundColor: 'var(--color-base-neutral-950)'");
      expect(harmonized).toContain("margin: 'var(--spacing-l)'");
    });

    it('audits and sanitizes fixed layout constraints', () => {
      const inputCode = `
        const MyComponent = () => {
          return <div style={{ width: "1200px", minWidth: "800px", height: "400px" }}>Layout</div>;
        }
      `;
      
      const auditResult = (extractor as any).auditAndSanitizeLayout(inputCode, 'MyComponent.tsx');
      
      expect(auditResult.modified).toBe(true);
      expect(auditResult.warnings.length).toBe(2);
      expect(auditResult.warnings[0]).toContain("Large fixed width constraint of 1200px found on property 'width'");
      expect(auditResult.warnings[1]).toContain("Large fixed width constraint of 800px found on property 'minWidth'");
      expect(auditResult.content).toContain('width: "100%", maxWidth: "1200px"');
    });

    it('extracts component TypeScript props definitions', () => {
      const inputCode = `
        export interface MyComponentProps {
          title: string;
          subtitle?: string;
          isOpen: boolean;
          onClick: () => void;
          avatarUrl?: string;
        }
        export default function MyComponent(props: MyComponentProps) { return null; }
      `;
      
      const props = (extractor as any).extractProps(inputCode);
      
      expect(props.length).toBe(5);
      
      expect(props[0]).toEqual({ name: 'title', type: 'string', required: true });
      expect(props[1]).toEqual({ name: 'subtitle', type: 'string', required: false });
      expect(props[2]).toEqual({ name: 'isOpen', type: 'boolean', required: true });
      expect(props[3]).toEqual({ name: 'onClick', type: 'function', required: true });
      expect(props[4]).toEqual({ name: 'avatarUrl', type: 'image', required: false });
    });
  });
});
