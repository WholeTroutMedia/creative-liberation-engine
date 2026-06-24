import * as fs from 'fs';
const files = fs.readdirSync('y:/creative-liberation-engine/runtime/ideation-queue').filter(f => f.endsWith('.json'));
const jobs = files.map(f => { try { return JSON.parse(fs.readFileSync('y:/creative-liberation-engine/runtime/ideation-queue/' + f)); } catch(e) { return null; } }).filter(j => j);
jobs.sort((a,b) => (b.jobNumber || 0) - (a.jobNumber || 0));
console.log(jobs.slice(0, 30).map(j => `[${j.jobId || j.id}] ${j.status} - ${j.sourceArticle?.title || j.source?.title || 'Unknown'}`).join('\n'));
