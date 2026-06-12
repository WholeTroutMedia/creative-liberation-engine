/**
 * One-shot script: Re-dispatch emails for ideations that were processed
 * but never emailed due to the cross-reference crash.
 * 
 * Usage: tsx src/resend-emails.ts
 */

import 'dotenv/config';
import { CONFIG } from './config.js';
import { loadAllManifests } from './job-registry.js';
import { sendIdeationEmail } from './email-dispatcher.js';
import { applyCrossReferences } from './cross-reference.js';

const TARGET_IDS: string[] = [
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
    console.log(`[RESEND] 📧 Re-dispatching emails for ${TARGET_IDS.length} ideations...`);
    console.log(`[RESEND] 📧 Sending to: ${CONFIG.notifyEmail}`);
    console.log(`[RESEND] 📧 Gmail User configured: ${CONFIG.gmailUser ? 'YES' : 'NO'}`);
    console.log(`[RESEND] 📧 Gmail App Password configured: ${CONFIG.gmailAppPassword ? 'YES' : 'NO'}`);
    console.log();

    const allManifests = loadAllManifests();
    console.log(`[RESEND] 📦 Loaded ${allManifests.length} total manifests`);

    let targets = TARGET_IDS;
    if (targets.length === 0) {
        console.log(`[RESEND] No TARGET_IDS specified, picking the most recent IDEATED manifest...`);
        const sorted = [...allManifests]
            .filter(m => m.status !== 'DISCARDED' && m.athenaOutput?.directive)
            .sort((a, b) => b.jobNumber - a.jobNumber);
        if (sorted.length > 0) {
            targets = [sorted[0].jobId];
        }
    }

    for (const targetId of targets) {
        const manifest = allManifests.find(m => m.jobId === targetId);
        if (!manifest) {
            console.error(`[RESEND] ❌ ${targetId} not found in queue`);
            continue;
        }

        if (!manifest.athenaOutput?.directive) {
            console.log(`[RESEND] ⏭️ ${targetId} has no ATHENA output — skipping`);
            continue;
        }

        if (manifest.status === 'DISCARDED') {
            console.log(`[RESEND] ⏭️ ${targetId} was DISCARDED — skipping`);
            continue;
        }

        console.log(`[RESEND] ═══════════════════════════════════════════`);
        console.log(`[RESEND] 📧 Sending: ${targetId}`);
        console.log(`[RESEND]    Title: ${manifest.sourceArticle?.title}`);
        console.log(`[RESEND]    Status: ${manifest.status}`);

        try {
            // Build cross-references for context
            const crossRefs = applyCrossReferences(manifest);
            
            // Send the email
            await sendIdeationEmail(manifest, crossRefs);
            console.log(`[RESEND] ✅ ${targetId} — Email sent successfully`);
        } catch (err: any) {
            console.error(`[RESEND] ❌ ${targetId} — Email failed: ${err.message}`);
        }

        // Small delay between sends
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log();
    console.log(`[RESEND] 🏁 Done.`);
}

main().catch(err => {
    console.error(`[RESEND] Fatal: ${err.message}`);
    process.exit(1);
});
