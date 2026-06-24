import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from './server.js';

const TEST_SANDBOX_DIR = path.resolve(process.cwd(), 'test_sandboxes');

beforeAll(() => {
  process.env.SANDBOX_DIR = TEST_SANDBOX_DIR;
  if (!fs.existsSync(TEST_SANDBOX_DIR)) {
    fs.mkdirSync(TEST_SANDBOX_DIR, { recursive: true });
  }
});

afterAll(() => {
  if (fs.existsSync(TEST_SANDBOX_DIR)) {
    fs.rmSync(TEST_SANDBOX_DIR, { recursive: true, force: true });
  }
});

describe('Workspace Autonomy Service API', () => {
  describe('GET /health', () => {
    it('should return service health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('online');
      expect(res.body.service).toBe('workspace-autonomy');
    });
  });

  describe('POST /api/v1/workspace/agentcore/execute', () => {
    it('should execute Bedrock AgentCore schema and resolve tool execution', async () => {
      const payload = {
        schema: {
          agentName: 'TestAgent',
          instruction: 'Verify and compile local files.',
          foundationModel: 'googleAI/gemini-2.5-flash',
          tools: [
            { type: 'code_interpreter', name: 'python_eval' }
          ]
        },
        prompt: 'run python compilation checks'
      };

      const res = await request(app)
        .post('/api/v1/workspace/agentcore/execute')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.agentName).toBe('TestAgent');
      expect(res.body.executedTools).toContain('code_interpreter');
      expect(res.body.output).toBeDefined();
    });
  });

  describe('POST /api/v1/workspace/artifact/render', () => {
    it('should render ArrowJS workspace artifact HTML and write to file', async () => {
      const payload = {
        artifactId: 'art-verification-dashboard',
        type: 'ui_component',
        title: 'System Verification Dashboard',
        content: 'const state = arrow({ checks: [] }); html`<div>ArrowJS active</div>`;',
        dependencies: [
          'https://cdn.jsdelivr.net/npm/@arrow-js/core'
        ],
        designTokens: {
          backgroundColor: '#020617',
          textColor: '#F8FAFC'
        }
      };

      const res = await request(app)
        .post('/api/v1/workspace/artifact/render')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.artifactId).toBe('art-verification-dashboard');
      expect(res.body.filePath).toBeDefined();

      // Check file was actually written to testing sandboxes
      const renderedFilePath = path.join(TEST_SANDBOX_DIR, 'art-verification-dashboard.html');
      expect(fs.existsSync(renderedFilePath)).toBe(true);

      const htmlContent = fs.readFileSync(renderedFilePath, 'utf-8');
      expect(htmlContent).toContain('System Verification Dashboard');
      expect(htmlContent).toContain('arrow-js/core');
      expect(htmlContent).toContain('#020617');
    });

    it('should fetch rendered HTML page through GET endpoint', async () => {
      const res = await request(app).get('/api/v1/workspace/artifact/art-verification-dashboard');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('ArrowJS active');
    });

    it('should return 404 if artifact does not exist', async () => {
      const res = await request(app).get('/api/v1/workspace/artifact/art-missing');
      expect(res.status).toBe(404);
      expect(res.text).toContain('not found');
    });

    it('should return 400 validation error if schema validation fails', async () => {
      const res = await request(app)
        .post('/api/v1/workspace/artifact/render')
        .send({
          artifactId: 'invalid_id_format',
          type: 'invalid_type',
          title: '',
          content: ''
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });
});
