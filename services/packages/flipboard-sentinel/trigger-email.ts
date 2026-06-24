import fs from 'node:fs';
import { loadAllManifests } from './src/job-registry.js';
import { sendIdeationEmail, buildIdeationEmailHtml } from './src/email-dispatcher.js';

async function main() {
    const manifests = loadAllManifests();
    const ideated = manifests.filter(m => m.athenaOutput);
    if (ideated.length > 0) {
        // Sort by created at descending
        ideated.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const latest = ideated[0];
        console.log(`Triggering email for ${latest.jobId}...`);
        
        const htmlContent = buildIdeationEmailHtml(latest, []);
        fs.writeFileSync('ideation-email-preview.html', htmlContent);
        console.log("Saved preview to ideation-email-preview.html");
        
        await sendIdeationEmail(latest, []);
        console.log("Email sent!");
    } else {
        console.log("No ideated manifests found.");
    }
}
main().catch(console.error);
