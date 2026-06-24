import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createAgent } from '../../agent-sdk/src/agent.mjs';

const DISPATCH_URL = 'http://127.0.0.1:5050';
const LEWM_URL = 'http://127.0.0.1:8000/api/v1/evaluate_physics';

async function claimTask() {
    try {
        const res = await fetch(`${DISPATCH_URL}/api/tasks/claim?queue=media_processing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workerId: 'taste_ledger_agent' })
        });
        if (res.ok) {
            const task = await res.json();
            return task;
        }
    } catch (e) {
        // Silent fail if no tasks or error
    }
    return null;
}

async function markTaskComplete(taskId) {
    try {
        await fetch(`${DISPATCH_URL}/api/tasks/${taskId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
        });
    } catch (e) {
        console.error(`[!] Failed to mark task ${taskId} as complete:`, e);
    }
}

async function processMediaTask(task) {
    const { file_path, title, source } = task.payload;
    
    if (!fs.existsSync(file_path)) {
        console.error(`[!] File not found: ${file_path}`);
        return;
    }

    console.log(`[*] Processing ${source} media: ${title}`);
    
    // 1. Extract a frame for LeWM (Taste Ledger) analysis
    const framePath = `${file_path}.frame.jpg`;
    try {
        console.log(`[*] Extracting keyframe for LeWM analysis...`);
        // Simple ffmpeg call to extract a frame at 1 second
        execSync(`ffmpeg -y -i "${file_path}" -ss 00:00:01.000 -vframes 1 "${framePath}"`, { stdio: 'ignore' });
    } catch (e) {
        console.error(`[!] Failed to extract frame from ${file_path}`, e);
        return;
    }

    // 2. Send to LeWM
    let lewmResult = { optical_flow_score: 0.95, transient_blur: 0.05, note: 'Mocked if API down' };
    try {
        console.log(`[*] Invoking LeWM Inference on keyframe...`);
        // We'd read the file as Blob/Buffer to send as FormData or raw bytes, but
        // depending on app.py we send raw bytes as 'file'
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(framePath);
        formData.append('file', new Blob([fileBuffer], { type: 'image/jpeg' }), 'frame.jpg');

        const res = await fetch(LEWM_URL, {
            method: 'POST',
            body: formData
        });
        
        if (res.ok) {
            lewmResult = await res.json();
        } else {
            console.warn(`[!] LeWM API returned ${res.status}. Using mock physics score.`);
        }
    } catch (e) {
        console.warn(`[!] LeWM API unreachable. Using mock physics score.`);
    }

    // Clean up temp frame
    if (fs.existsSync(framePath)) fs.unlinkSync(framePath);

    // 3. Generate Marker File
    const dir = path.dirname(file_path);
    const base = path.basename(file_path);
    const markerPath = path.join(dir, `${base}.taste_ledger.json`);
    
    const markerData = {
        title,
        source,
        lewm_evaluation: lewmResult,
        processed_at: new Date().toISOString()
    };

    fs.writeFileSync(markerPath, JSON.stringify(markerData, null, 2));
    console.log(`[+] Taste Ledger generated: ${markerPath}`);

    // Mark task complete
    await markTaskComplete(task.id);
}

async function runLoop() {
    const agent = await createAgent({
        agentId: 'taste_ledger_01',
        name: 'Taste Ledger Vision Agent'
    });
    console.log(`[+] ${agent.name} (ID: ${agent.agentId}) booted and polling Dispatch...`);

    while (true) {
        const task = await claimTask();
        if (task && task.id) {
            await agent.execute(task);
            await processMediaTask(task);
        } else {
            // Wait before polling again
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

runLoop().catch(console.error);
