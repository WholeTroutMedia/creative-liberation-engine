import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logMemoryTransaction } from '../../services/averi-memory-service/src/modules/memory-history';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('WS-03 — Averi Memory History Transaction Logging', () => {
  const testDocId = 'test-doc-123';
  const testCollection = 'test-collection';
  const testState = { key: 'value', count: 42 };
  
  it('successfully logs a memory transaction file and generates git audit trail', async () => {
    const historyDir = path.join(projectRoot, `runtime/memory/history/${testCollection}/${testDocId}`);
    
    // Clean up previous history for this test document if it exists
    if (fs.existsSync(historyDir)) {
      fs.rmSync(historyDir, { recursive: true, force: true });
    }
    
    // Log create transaction
    await logMemoryTransaction(testDocId, testCollection, testState, 'create');
    
    // Verify directory was created
    expect(fs.existsSync(historyDir)).toBe(true);
    
    // Verify file exists
    const files = fs.readdirSync(historyDir);
    expect(files.length).toBeGreaterThanOrEqual(1);
    
    const loggedFile = files.find(f => f.endsWith('_create.json'));
    expect(loggedFile).toBeDefined();
    
    const loggedFilePath = path.join(historyDir, loggedFile!);
    const rawContent = fs.readFileSync(loggedFilePath, 'utf8');
    const payload = JSON.parse(rawContent);
    
    expect(payload.docId).toBe(testDocId);
    expect(payload.collection).toBe(testCollection);
    expect(payload.action).toBe('create');
    expect(payload.state).toEqual(testState);
    expect(payload.timestamp).toBeDefined();
  }, 30000);
});
