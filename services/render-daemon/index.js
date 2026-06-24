import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// NAS paths for synthesis
const NAS_WATCH_DIR = '/app/genesis-deploy/runtime/render/input';
const NAS_OUTPUT_DIR = '/app/genesis-deploy/runtime/render/output';

// We assume aerender is accessible via network execution or wine if running on NAS
// If running on local Windows node, it would be "C:\\Program Files\\Adobe\\Adobe After Effects 2024\\Support Files\\aerender.exe"
// For sovereign architecture, we stub the actual execution
const AERENDER_PATH = process.env.AERENDER_PATH || 'aerender';

console.log(`[RENDER-DAEMON] Initializing Procedural Media Synthesis...`);
console.log(`[RENDER-DAEMON] Watch directory: ${NAS_WATCH_DIR}`);

// Stub watch and render loop
setInterval(async () => {
  try {
    if (!fs.existsSync(NAS_WATCH_DIR)) return;
    
    const files = fs.readdirSync(NAS_WATCH_DIR);
    const aepFiles = files.filter(f => f.endsWith('.aep'));
    
    for (const file of aepFiles) {
      console.log(`[RENDER-DAEMON] Discovered new render job: ${file}`);
      const inputPath = path.join(NAS_WATCH_DIR, file);
      const outputPath = path.join(NAS_OUTPUT_DIR, file.replace('.aep', '.mp4'));
      
      console.log(`[RENDER-DAEMON] Executing aerender: ${inputPath} -> ${outputPath}`);
      
      try {
        // Execute aerender in a cross-platform way (wine on Linux, native on Windows)
        // If NAS is linux, we wrap in wine if AERENDER_PATH points to an .exe
        const command = AERENDER_PATH.endsWith('.exe') && process.platform !== 'win32'
          ? `wine "${AERENDER_PATH}" -project "${inputPath}" -comp "Main" -output "${outputPath}"`
          : `"${AERENDER_PATH}" -project "${inputPath}" -comp "Main" -output "${outputPath}"`;
          
        await execPromise(command);
        
        // Move to completed
        const doneDir = path.join(NAS_WATCH_DIR, 'done');
        if (!fs.existsSync(doneDir)) fs.mkdirSync(doneDir, { recursive: true });
        fs.renameSync(inputPath, path.join(doneDir, file));
        
        console.log(`[RENDER-DAEMON] Render complete: ${outputPath}`);
      } catch (err) {
        console.error(`[RENDER-DAEMON] Render failed for ${file}:`, err.message);
        const failedDir = path.join(NAS_WATCH_DIR, 'failed');
        if (!fs.existsSync(failedDir)) fs.mkdirSync(failedDir, { recursive: true });
        fs.renameSync(inputPath, path.join(failedDir, file));
      }
    }
  } catch (e) {
    console.error('[RENDER-DAEMON] Error:', e.message);
  }
}, 5000);
