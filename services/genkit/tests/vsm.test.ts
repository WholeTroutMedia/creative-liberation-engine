import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { VirtualSynchronyMachine } from '../src/negotiation/vsm';

const TEST_WORKSPACE = path.join(__dirname, '.test_vsm_workspace');

describe('VirtualSynchronyMachine (VSM)', () => {
  let vsm: VirtualSynchronyMachine;

  beforeEach(async () => {
    vsm = new VirtualSynchronyMachine(TEST_WORKSPACE);
  });

  afterEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true });
  });

  it('should publish a task and allow an agent to cleanly claim it', async () => {
    const taskId = await vsm.publishTask('Perform Lunar Core Analysis');
    expect(taskId).toBeDefined();

    const task = await vsm.claimNextTask('Agent-Rover-1');
    expect(task).not.toBeNull();
    expect(task?.description).toBe('Perform Lunar Core Analysis');
    expect(task?.status).toBe('claimed');
    expect(task?.assignedTo).toBe('Agent-Rover-1');

    // Queue should now have zero open tasks
    const nextTask = await vsm.claimNextTask('Agent-Rover-2');
    expect(nextTask).toBeNull();
  });
});
