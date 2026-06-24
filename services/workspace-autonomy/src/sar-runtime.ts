import fs from 'fs';
import path from 'path';
import pino from 'pino';

const logger = pino({
  name: 'workspace-autonomy:sar-runtime',
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined
});

export interface SARRenderRequest {
  artifactId: string;
  type: 'ui_component' | 'code_snippet' | 'interactive_dashboard' | 'document';
  title: string;
  content: string;
  version?: number;
  dependencies?: string[];
  designTokens?: Record<string, any>;
}

export interface SARRenderResponse {
  artifactId: string;
  url: string;
  filePath: string;
  version: number;
  compiledSize: number;
}

export class SARRuntime {
  private sandboxDir: string;
  private registryDir: string;

  constructor() {
    this.sandboxDir = path.resolve(process.cwd(), '../../runtime/sandboxes');
    this.registryDir = path.resolve(process.cwd(), '../../runtime/registry');
  }

  private getSandboxDir(): string {
    const dir = process.env.SANDBOX_DIR || this.sandboxDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Render a dynamic self-hosted ArrowJS / HTML workspace sandbox
   */
  public async render(request: SARRenderRequest): Promise<SARRenderResponse> {
    const version = request.version || 1;
    const targetFilename = `${request.artifactId}.html`;
    const sandboxDir = this.getSandboxDir();
    const targetFilePath = path.join(sandboxDir, targetFilename);

    logger.info({ artifactId: request.artifactId, targetFilePath }, 'Compiling dynamic SAR workspace');

    // 1. Build zero-build interactive HTML container
    let compiledHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CLE Workspace Artifact: ${request.title}</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: 'Outfit', sans-serif;
      background-color: ${request.designTokens?.backgroundColor || '#0F172A'};
      color: ${request.designTokens?.textColor || '#E2E8F0'};
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5);
    }
    .header {
      margin-bottom: 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 16px;
    }
    h1 {
      margin: 0;
      font-size: 28px;
      background: linear-gradient(135deg, #60A5FA, #3B82F6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(96, 165, 250, 0.2);
      color: #60A5FA;
      margin-top: 8px;
    }
  </style>
  <!-- Load requested external dynamic dependencies -->
  ${(request.dependencies || []).map(dep => `<script src="${dep}"></script>`).join('\n  ')}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${request.title}</h1>
      <span class="badge">Type: ${request.type.replace('_', ' ').toUpperCase()} | Version: ${version}</span>
    </div>
    <div id="app">
      ${request.type === 'ui_component' || request.type === 'interactive_dashboard' ? '' : request.content}
    </div>
  </div>

  <!-- Dynamic JS Execution Sandbox -->
  <script type="module">
    try {
      // Direct ArrowJS or ESM integration support
      ${request.type === 'ui_component' || request.type === 'interactive_dashboard' ? request.content : ''}
    } catch (err) {
      console.error('Workspace dynamic execution failure:', err);
      document.getElementById('app').innerHTML = '<div style="color: #EF4444; padding: 16px; border: 1px solid #EF4444; border-radius: 8px;">Workspace rendering failed: ' + err.message + '</div>';
    }
  </script>
</body>
</html>
`;

    // 2. Write compiled file
    fs.writeFileSync(targetFilePath, compiledHTML, 'utf-8');

    // 3. Update Registry record
    const metaPath = path.join(this.sandboxDir, `${request.artifactId}.json`);
    fs.writeFileSync(metaPath, JSON.stringify({
      artifactId: request.artifactId,
      title: request.title,
      type: request.type,
      version,
      renderedAt: new Date().toISOString(),
      designTokens: request.designTokens || {}
    }, null, 2), 'utf-8');

    return {
      artifactId: request.artifactId,
      url: `/api/v1/workspace/artifact/${request.artifactId}`,
      filePath: targetFilePath,
      version,
      compiledSize: compiledHTML.length
    };
  }

  /**
   * Fetch rendered file content
   */
  public getArtifactHTML(artifactId: string): string | null {
    const sandboxDir = this.getSandboxDir();
    const filePath = path.join(sandboxDir, `${artifactId}.html`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  }
}
