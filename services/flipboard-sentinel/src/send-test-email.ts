/**
 * Quick email-only test: loads the most recent IDEATED manifest and sends email.
 * Does NOT re-run ATHENA. Just emails the existing ideation.
 * 
 * Usage: NAS_RUNTIME_PATH=\\122.0.3.1\docker\creative-liberation-engine\runtime npx tsx src/send-test-email.ts
 */
import 'dotenv/config';
import { loadAllManifests, JobManifest } from './job-registry.js';
import { sendIdeationEmail } from './email-dispatcher.js';
import { applyCrossReferences } from './cross-reference.js';

async function main() {
    const all = loadAllManifests();
    console.log(`[TEST] Loaded ${all.length} manifests`);

    // Find the most recent IDEATED manifest with athena output
    const ideated = all
        .filter(m => m.status === 'IDEATED' && m.athenaOutput?.directive)
        .sort((a, b) => new Date(b.ideatedAt || b.createdAt).getTime() - new Date(a.ideatedAt || a.createdAt).getTime());

    if (ideated.length === 0) {
        // Fallback: any manifest with athena output regardless of status
        const withAthena = all
            .filter(m => m.athenaOutput?.directive)
            .sort((a, b) => new Date(b.ideatedAt || b.createdAt).getTime() - new Date(a.ideatedAt || a.createdAt).getTime());

        if (withAthena.length === 0) {
            console.error('[TEST] No manifests with ATHENA output found');
            process.exit(1);
        }
        
        console.log(`[TEST] No IDEATED manifests, using latest with ATHENA output:`);
        const target = withAthena[0];
        console.log(`  ${target.jobId}: ${target.sourceArticle.title} (status: ${target.status})`);
        console.log(`  Options: ${target.athenaOutput!.options.length}`);
        console.log(`  Directive: ${target.athenaOutput!.directive.substring(0, 80)}...`);

        const crossRefs = applyCrossReferences(target);
        console.log(`[TEST] 📧 Sending email...`);
        await sendIdeationEmail(target, crossRefs);
        console.log(`[TEST] ✅ Done!`);
        return;
    }

    const target = ideated[0];
    console.log(`[TEST] Most recent IDEATED:`);
    console.log(`  ${target.jobId}: ${target.sourceArticle.title}`);
    console.log(`  Options: ${target.athenaOutput!.options.length}`);
    console.log(`  Directive: ${target.athenaOutput!.directive.substring(0, 80)}...`);

    const crossRefs = applyCrossReferences(target);
    console.log(`[TEST] 📧 Sending email...`);
    await sendIdeationEmail(target, crossRefs);
    console.log(`[TEST] ✅ Done!`);
}

main().catch(err => {
    console.error(`[TEST] Fatal: ${err.message}`);
    process.exit(1);
});
