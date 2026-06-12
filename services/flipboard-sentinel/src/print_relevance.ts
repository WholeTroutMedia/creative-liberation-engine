import 'dotenv/config';
import { loadAllManifests } from './job-registry.js';

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
    for (const jobId of TARGET_IDS) {
        const m = allManifests.find(x => x.jobId === jobId);
        if (m) {
            console.log(`${m.jobId}|${m.inceptionRelevance}|${m.sourceArticle.title}`);
        } else {
            console.log(`${jobId}|NOT_FOUND`);
        }
    }
}

main().catch(console.error);
