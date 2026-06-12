import 'dotenv/config';
import { CONFIG } from './src/config.js';
import { loadAllManifests, updateManifest, JobManifest } from './src/job-registry.js';
import { sendIdeationEmail } from './src/email-dispatcher.js';
import { applyCrossReferences } from './src/cross-reference.js';
import { extractArticleText } from './src/article-extractor.js';

async function dispatchAthena(article: any, articleText: string, depth: string) {
    const apiKey = process.env.GENKIT_API_KEY || '';
    const response = await fetch(`${CONFIG.genkitBaseUrl}/sentinel/ideate`, {
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
    const allManifests = loadAllManifests();
    // Sort by createdAt descending to get the latest
    allManifests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Filter out discarded ones just in case
    const validManifests = allManifests.filter(m => m.status !== 'DISCARDED' && m.status !== 'ARCHIVED');
    
    if (validManifests.length === 0) {
        console.log('No valid manifests found.');
        return;
    }
    
    const manifest = validManifests[0];
    console.log(`[TEST] Forcing re-ideation for the latest manifest: ${manifest.jobId} - ${manifest.sourceArticle.title}`);
    
    const fullText = await extractArticleText(manifest.sourceArticle.url, '');
    console.log(`[TEST] Extracted ${fullText.length} chars. Calling ATHENA...`);
    
    const athenaResult = await dispatchAthena(manifest.sourceArticle, fullText, 'exhaustive');
    
    console.log('[TEST] ATHENA Result obtained. Options:', athenaResult.options?.length);
    
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
    
    updateManifest(manifest);
    
    if (manifest.status !== 'DISCARDED') {
        const crossRefs = applyCrossReferences(manifest);
        await sendIdeationEmail(manifest, crossRefs);
        console.log('[TEST] Email sent successfully with real new ideation data.');
    } else {
        console.log('[TEST] ATHENA discarded the article. Email not sent.');
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
