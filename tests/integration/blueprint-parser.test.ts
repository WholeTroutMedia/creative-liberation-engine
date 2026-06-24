import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('WS-10 — ConTech Blueprint Parser CLI', () => {
  const scriptPath = path.join(projectRoot, 'scripts/blueprint_parser.py');
  const inputPath = path.join(projectRoot, 'scratch/test_blueprint.txt');
  const outputPath = path.join(projectRoot, 'runtime/contech/quantities_test.json');

  it('script is accessible and executable', async () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  it('runs quantity takeoff on test dummy drawing', async () => {
    // Clean up old files if they exist
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    const command = `python "${scriptPath}" --input "${inputPath}" --output "${outputPath}"`;
    const { stdout, stderr } = await execPromise(command);
    
    expect(stderr).toBe('');
    expect(stdout).toContain('Takeoff quantities written successfully');

    // Verify output existence
    expect(fs.existsSync(outputPath)).toBe(true);

    // Verify parsed data
    const rawData = fs.readFileSync(outputPath, 'utf8');
    const data = JSON.parse(rawData);
    
    expect(data.project_name).toBe('Sovereign B2B ConTech Operations');
    expect(data.status).toBe('COMPLETED');
    expect(data.quantities.plumbing_fixtures).toBe(3);
    expect(data.quantities.doors_windows).toBe(4);
    expect(data.quantities.drywall_linear_foot).toBe(150.5);
  });

  it('falls back cleanly to sovereign B2B defaults for non-existent files', async () => {
    const fakeInput = path.join(projectRoot, 'scratch/does_not_exist.png');
    const fakeOutput = path.join(projectRoot, 'runtime/contech/quantities_fallback.json');

    if (fs.existsSync(fakeOutput)) {
      fs.unlinkSync(fakeOutput);
    }

    const command = `python "${scriptPath}" --input "${fakeInput}" --output "${fakeOutput}"`;
    await execPromise(command);

    expect(fs.existsSync(fakeOutput)).toBe(true);
    const data = JSON.parse(fs.readFileSync(fakeOutput, 'utf8'));
    
    // Fallback defaults verification
    expect(data.quantities.plumbing_fixtures).toBe(12);
    expect(data.quantities.doors_windows).toBe(8);
    expect(data.quantities.drywall_linear_foot).toBe(320.5);
  });
});
