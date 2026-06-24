/**
 * Dynamic Symphony Router Retroactive Migration Script
 * Classifies all existing 'IDEATED' and active jobs, writes bi-directional links
 * to active Theme epics on the NAS, and updates the Obsidian vaults.
 *
 * Usage: tsx src/route-all-active.ts
 */

import 'dotenv/config';
import { loadAllManifests, updateManifest } from './job-registry.js';
import { applyCrossReferences } from './cross-reference.js';
import { writeObsidianNote, writeSentinelDashboard } from './obsidian-writer.js';
import { routeManifestToThemes, linkJobToThemeFile } from './workstream-router.js';

async function main() {
    console.log('[SYMPHONY-MIGRATION] 🚀 Launching Symphony Router retroactive classification...');
    const allManifests = loadAllManifests();
    console.log(`[SYMPHONY-MIGRATION] 📦 Loaded ${allManifests.length} total manifests`);

    const activeJobs = allManifests.filter(m => m.status === 'IDEATED' || m.status === 'PLANNED' || m.status === 'SHIPPED');
    console.log(`[SYMPHONY-MIGRATION] 🔍 Found ${activeJobs.length} active jobs to classify & link.`);

    let successCount = 0;
    
    for (const manifest of activeJobs) {
        console.log(`[SYMPHONY-MIGRATION] 🔄 Routing: ${manifest.jobId} - ${manifest.sourceArticle.title}`);
        
        try {
            // 1. Calculate best matching Theme
            const { primaryTheme, score } = routeManifestToThemes(manifest);
            
            if (primaryTheme) {
                console.log(`[SYMPHONY-MIGRATION]    📡 Mapped to: ${primaryTheme.id} (Confidence: ${score})`);
                
                // 2. Perform bi-directional link in docs/epics/Theme-X.md
                linkJobToThemeFile(manifest, primaryTheme);
                
                // 3. Re-save manifest to update the file metadata if required (obsidian-writer handles memory representation)
                updateManifest(manifest);
                
                // 4. Update the Obsidian Note (computes frontmatter and appends theme workstream banner)
                const crossRefs = applyCrossReferences(manifest);
                writeObsidianNote(manifest, crossRefs);
                
                successCount++;
            } else {
                console.log('[SYMPHONY-MIGRATION]    ⚪ Low signal / no clear strategic theme matched.');
                
                // Still rewrite note to refresh standard formatting or cross references
                const crossRefs = applyCrossReferences(manifest);
                writeObsidianNote(manifest, crossRefs);
            }
        } catch (err: any) {
            console.error(`[SYMPHONY-MIGRATION] ❌ Failed to route ${manifest.jobId}: ${err.message}`);
        }
    }

    console.log('[SYMPHONY-MIGRATION] 📊 Updating Sentinel MOC Dashboard...');
    writeSentinelDashboard();

    console.log('═══════════════════════════════════════════');
    console.log(`[SYMPHONY-MIGRATION] 🎉 Done! Successfully processed ${successCount}/${activeJobs.length} jobs.`);
}

main().catch(err => {
    console.error(`[SYMPHONY-MIGRATION] Fatal error: ${err.message}`);
    process.exit(1);
});
