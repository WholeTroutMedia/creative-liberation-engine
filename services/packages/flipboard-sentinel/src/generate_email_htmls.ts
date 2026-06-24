import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { loadAllManifests } from './job-registry.js';
import { buildIdeationEmailHtml } from './email-dispatcher.js';
import { applyCrossReferences } from './cross-reference.js';

const TARGET_IDS = [
    'IE-IDX-0379',
    'IE-IDX-0380',
    'IE-IDX-0381',
    'IE-IDX-0382',
    'IE-IDX-0383',
    'IE-IDX-0384',
    'IE-IDX-0385',
    'IE-IDX-0386',
    'IE-IDX-0387'
];

async function main() {
    const allManifests = loadAllManifests();
    const outputDir = path.resolve('./src/temp_emails');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const jobId of TARGET_IDS) {
        const manifest = allManifests.find(m => m.jobId === jobId);
        if (!manifest) {
            console.error(`[GEN-HTML] ❌ ${jobId} not found`);
            continue;
        }

        const crossRefs = applyCrossReferences(manifest);
        const html = buildIdeationEmailHtml(manifest, crossRefs);
        
        const filePath = path.join(outputDir, `${jobId}.html`);
        fs.writeFileSync(filePath, html, 'utf-8');
        console.log(`[GEN-HTML] ✅ Generated HTML for ${jobId} -> ${filePath}`);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
