import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// WS-03: Sovereign Memory Spine History & Versioning
// Provides transaction-level git-backed logging for all canonical memory changes.

function findProjectRoot(): string {
    let current = __dirname;
    while (current) {
        if (fs.existsSync(path.join(current, 'AGENTS.md'))) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    return process.cwd();
}

export async function logMemoryTransaction(docId: string, collection: string, state: any, action: 'create' | 'update' | 'delete' | 'sync') {
    const projectRoot = findProjectRoot();
    const historyDir = path.join(projectRoot, `runtime/memory/history/${collection}/${docId}`);
    
    if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const transactionFile = path.join(historyDir, `${timestamp}_${action}.json`);
    
    const payload = {
        docId,
        collection,
        action,
        timestamp: new Date().toISOString(),
        state
    };
    
    fs.writeFileSync(transactionFile, JSON.stringify(payload, null, 2));
    console.log(`[MEMORY HISTORY] Logged transaction ${action} for ${docId}`);
    
    // Auto-git commit if in a git repository to satisfy B2B git-based versioning
    const gitDir = path.join(projectRoot, '.git');
    if (fs.existsSync(gitDir)) {
        // Run Git operations asynchronously in the background so we do not block response or tests
        (async () => {
            try {
                await execPromise(`git add "${transactionFile}"`, { cwd: projectRoot, timeout: 5000 });
                const commitMessage = `[MEMORY SPINE] ${action.toUpperCase()} - ${collection}/${docId} at ${timestamp}`;
                await execPromise(`git commit -m "${commitMessage}"`, { cwd: projectRoot, timeout: 5000 });
                console.log(`[MEMORY GIT-OPS] Committed transaction to Git history: ${docId}`);
            } catch (err: any) {
                console.log(`[MEMORY GIT-OPS] Git commit deferred: ${err.message}`);
            }
        })();
    }
}
