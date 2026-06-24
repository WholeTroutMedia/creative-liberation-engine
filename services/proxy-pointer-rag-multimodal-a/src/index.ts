import * as fs from 'fs';
import * as path from 'path';

export interface FilePointer {
  id: string;
  filename: string;
  absolutePath: string;
  extension: string;
  sizeBytes: number;
  indexedAt: string;
  tags: string[];
}

export interface ExecutionResult {
  success: boolean;
  capabilityId: string;
  pointersCount?: number;
  results?: FilePointer[];
  error?: string;
}

// Robust root detection
function getRootDir(): string {
  if (fs.existsSync('/app/creative-liberation-engine')) return '/app/creative-liberation-engine';
  if (fs.existsSync('Y:/creative-liberation-engine')) return 'Y:/creative-liberation-engine';
  if (fs.existsSync('y:/creative-liberation-engine')) return 'y:/creative-liberation-engine';
  return path.resolve(__dirname, '../../..');
}

export class ProxyPointerRegistry {
  private indexPath: string;
  private pointers: FilePointer[] = [];

  constructor() {
    const rootDir = getRootDir();
    const dbDir = path.join(rootDir, 'runtime/db');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.indexPath = path.join(dbDir, 'proxy-pointer-rag.json');
    this.loadIndex();
  }

  private loadIndex() {
    if (fs.existsSync(this.indexPath)) {
      try {
        this.pointers = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8'));
      } catch {
        this.pointers = [];
      }
    }
  }

  private saveIndex() {
    fs.writeFileSync(this.indexPath, JSON.stringify(this.pointers, null, 2), 'utf-8');
  }

  public registerPointer(absolutePath: string, tags: string[] = []): FilePointer {
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File does not exist at path: ${absolutePath}`);
    }

    const stat = fs.statSync(absolutePath);
    const filename = path.basename(absolutePath);
    const extension = path.extname(absolutePath).toLowerCase();
    
    // Generate unique ID based on absolute path
    const id = 'ptr_' + Buffer.from(absolutePath).toString('base64').substring(0, 16).replace(/[^a-zA-Z0-9]/g, '');

    const existingIndex = this.pointers.findIndex(p => p.absolutePath === absolutePath);
    const pointer: FilePointer = {
      id,
      filename,
      absolutePath,
      extension,
      sizeBytes: stat.size,
      indexedAt: new Date().toISOString(),
      tags: Array.from(new Set([...tags, extension.substring(1), filename.toLowerCase()]))
    };

    if (existingIndex !== -1) {
      this.pointers[existingIndex] = pointer;
    } else {
      this.pointers.push(pointer);
    }

    this.saveIndex();
    return pointer;
  }

  public searchPointers(query: string): FilePointer[] {
    const term = query.toLowerCase().trim();
    if (!term) return this.pointers;

    return this.pointers.filter(p => {
      return (
        p.filename.toLowerCase().includes(term) ||
        p.absolutePath.toLowerCase().includes(term) ||
        p.tags.some(tag => tag.includes(term))
      );
    });
  }

  public getPointer(id: string): FilePointer | undefined {
    return this.pointers.find(p => p.id === id);
  }

  public getPointersCount(): number {
    return this.pointers.length;
  }
}

export async function executeCapability(payload?: {
  action?: 'index' | 'search' | 'get';
  filePath?: string;
  query?: string;
  id?: string;
  tags?: string[];
}): Promise<ExecutionResult> {
  try {
    const registry = new ProxyPointerRegistry();
    const action = payload?.action || 'search';

    if (action === 'index') {
      if (!payload?.filePath) {
        return { success: false, capabilityId: 'IE-IDX-0113', error: 'filePath is required for indexing' };
      }
      const ptr = registry.registerPointer(payload.filePath, payload.tags || []);
      return {
        success: true,
        capabilityId: 'IE-IDX-0113',
        pointersCount: registry.getPointersCount(),
        results: [ptr]
      };
    } else if (action === 'get') {
      if (!payload?.id) {
        return { success: false, capabilityId: 'IE-IDX-0113', error: 'id is required for retrieval' };
      }
      const ptr = registry.getPointer(payload.id);
      return {
        success: true,
        capabilityId: 'IE-IDX-0113',
        results: ptr ? [ptr] : []
      };
    } else {
      // Default: Search
      const query = payload?.query || '';
      const results = registry.searchPointers(query);
      return {
        success: true,
        capabilityId: 'IE-IDX-0113',
        pointersCount: registry.getPointersCount(),
        results
      };
    }
  } catch (err: any) {
    return {
      success: false,
      capabilityId: 'IE-IDX-0113',
      error: err?.message || String(err)
    };
  }
}

// Self-execute if executed directly from terminal
import { fileURLToPath } from 'url';
const nodePath = process.argv[1];
if (nodePath && fs.existsSync(nodePath) && fs.realpathSync(nodePath) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  executeCapability({ action: 'search' }).then(res => {
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.success ? 0 : 1);
  });
}
