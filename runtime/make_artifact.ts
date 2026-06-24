import * as fs from 'fs';
const files = fs.readdirSync('y:/creative-liberation-engine/runtime/ideation-queue').filter(f => f.endsWith('.json'));
const jobs = files.map(f => { try { return JSON.parse(fs.readFileSync('y:/creative-liberation-engine/runtime/ideation-queue/' + f)); } catch(e) { return null; } }).filter(j => j);
jobs.sort((a,b) => (b.jobNumber || 0) - (a.jobNumber || 0));

let md = '# Recent Flipboard Ideations for Review\n\n';

for (const j of jobs.slice(0, 10)) {
  if (j.status === 'ARCHIVED' || j.status === 'DISCARDED') continue;
  const title = j.sourceArticle?.title || j.source?.title || 'Unknown';
  md += `## [${j.jobId || j.id}] ${title}\n`;
  md += `- **Status**: ${j.status}\n`;
  md += `- **URL**: ${j.sourceArticle?.url || j.source?.url || 'N/A'}\n\n`;
  
  if (j.athenaOutput) {
    md += `### ATHENA Rationale\n${j.athenaOutput.rationale}\n\n`;
    md += `### Options\n`;
    for (const opt of j.athenaOutput.options) {
      md += `#### ${opt.title} (${opt.recommendation})\n`;
      md += `${opt.description}\n\n`;
      md += `- **Tradeoffs**: ${opt.tradeoffs}\n`;
      md += `- **Architecture**: ${opt.architecture || 'N/A'}\n`;
      md += `- **Design**: ${opt.design || 'N/A'}\n\n`;
    }
  } else {
    md += `*No ATHENA Output available.*\n\n`;
  }
  md += `---\n\n`;
}

fs.writeFileSync('C:/Users/jahar/.gemini/antigravity/brain/fccb6f40-e0ba-47e6-8b42-c65f8238ef53/artifacts/recent_ideations.md', md);
console.log('Artifact created at recent_ideations.md');
