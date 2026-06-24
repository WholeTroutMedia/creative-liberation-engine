import 'dotenv/config';
// Override NAS paths to use Windows mapped drive when running locally
process.env.NAS_RUNTIME_PATH = 'y:\\creative-liberation-engine\\runtime';
process.env.OBSIDIAN_VAULT_PATH = 'y:\\creative-liberation-engine\\runtime\\nexus-vault';

import fs from 'node:fs';
import { CONFIG } from './src/config.js';
import { loadAllManifests, updateManifest, JobManifest } from './src/job-registry.js';
import { sendIdeationEmail } from './src/email-dispatcher.js';
import { applyCrossReferences } from './src/cross-reference.js';
import { extractArticleText } from './src/article-extractor.js';
import { writeObsidianNote } from './src/obsidian-writer.js';

async function dispatchAthena(article: any, articleText: string, depth: string) {
    const apiKey = process.env.GENKIT_API_KEY || 'v6-local-key';
    const baseUrl = 'http://127.0.0.1:4000'; // Live Genkit service on the NAS
    console.log(`[SCRATCH] Connecting to Genkit at: ${baseUrl}`);
    
    const response = await fetch(`${baseUrl}/sentinel/ideate`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            title: article.title,
            url: article.url,
            author: article.author,
            text: `Title: ${article.title}\nAuthor: ${article.author}\nURL: ${article.url}\nPublished: ${article.pubDate}\n\nFull Text:\n${articleText}`,
            depth,
        }),
    });
    if (!response.ok) throw new Error(`ATHENA failed: ${await response.text()}`);
    const result = await response.json() as any;
    return result.athena || result.output || result;
}

async function main() {
    const jobId = 'IE-IDX-0251';
    console.log(`[SCRATCH] CONFIG.queueDir: ${CONFIG.queueDir}`);
    console.log(`[SCRATCH] fs.existsSync(CONFIG.queueDir): ${fs.existsSync(CONFIG.queueDir)}`);
    if (fs.existsSync(CONFIG.queueDir)) {
        console.log(`[SCRATCH] Files in queueDir: ${fs.readdirSync(CONFIG.queueDir).slice(0, 5).join(', ')}`);
    }
    
    console.log(`[SCRATCH] Loading job manifest for ${jobId}...`);
    const allManifests = loadAllManifests();
    console.log(`[SCRATCH] Total manifests loaded: ${allManifests.length}`);
    const manifest = allManifests.find(m => m.jobId === jobId);
    
    if (!manifest) {
        console.error(`[SCRATCH] Job ${jobId} not found in the registry.`);
        return;
    }
    
    console.log(`[SCRATCH] Starting extraction for URL: ${manifest.sourceArticle.url}`);
    
    // We run the newly programmed extraction logic which will execute secure automated login to x.com if needed!
    const fullText = await extractArticleText(manifest.sourceArticle.url, 'No fallback needed.');
    
    console.log(`\n===================================`);
    console.log(`[SCRATCH] EXTRACTED CONTENT RESULT`);
    console.log(`===================================`);
    console.log(fullText.slice(0, 1500));
    console.log(`===================================\n`);
    
    if (fullText.length < 50) {
        console.warn(`[SCRATCH] Warning: Extracted content is very short (${fullText.length} chars).`);
    }
    
    console.log(`[SCRATCH] Dispatching to ATHENA for ideation...`);
    const athenaResult = await dispatchAthena(manifest.sourceArticle, fullText, 'exhaustive');
    
    console.log(`\n===================================`);
    console.log(`[SCRATCH] ATHENA IDEATION OUTPUT`);
    console.log(`===================================`);
    console.log(`Directive: ${athenaResult.directive}`);
    console.log(`Rationale: ${athenaResult.rationale}`);
    console.log(`Options Count: ${athenaResult.options?.length || 0}`);
    console.log(`===================================\n`);
    
    manifest.athenaOutput = {
        directive: athenaResult.directive,
        rationale: athenaResult.rationale,
        options: athenaResult.options || [],
        suggestedAgents: athenaResult.suggestedAgents || [],
        nextMode: athenaResult.nextMode || 'PLAN',
        constitutionalFlags: athenaResult.constitutionalFlags || [],
    };
    manifest.status = athenaResult.nextMode === 'DISCARD' ? 'DISCARDED' : 'IDEATED';
    manifest.ideatedAt = new Date().toISOString();
    
    // Update active status so it compiles
    console.log(`[SCRATCH] Updating job manifest in registry...`);
    updateManifest(manifest);
    
    console.log(`[SCRATCH] Generating Obsidian Note...`);
    const crossRefs = applyCrossReferences(manifest);
    writeObsidianNote(manifest, crossRefs);
    
    console.log(`[SCRATCH] Sending Ideation Email to Operator...`);
    await sendIdeationEmail(manifest, crossRefs);
    
    console.log(`[SCRATCH] 🎉 All steps completed successfully!`);
}

main().catch(err => {
    console.error('Fatal error in scratch script:', err);
    process.exit(1);
});
