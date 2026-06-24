import { generate } from '@genkit-ai/ai';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execPromise = util.promisify(exec);

/**
 * Phase 2: Autonomous Discovery Agent
 * When the Creative Liberation Engine encounters a knowledge gap, it passes the topic here.
 * This agent generates targeted search queries and autonomously dispatches the harvesters.
 */
export async function discoverAndIngest(knowledgeGap: string, discipline: string = 'ATHENA') {
  console.log(`[Phase 2] Analyzing knowledge gap: "${knowledgeGap}"`);

  // 1. Ask Gemini to generate optimal search queries
  const prompt = `
    You are the Autonomous Discovery Agent for the Creative Liberation Engine.
    We have a knowledge gap regarding: "${knowledgeGap}".
    Generate 3 highly specific, expert-level YouTube search queries that would yield the best educational content to fill this gap.
    Format your response as a strict JSON array of strings. No markdown formatting.
    Example: ["advanced React Server Components architecture", "Next.js 14 caching strategies deep dive"]
  `;

  try {
    const response = await generate({
      model: process.env.MODEL_CLOUD_MAX || 'googleai/gemini-pro-latest',
      prompt: prompt,
      config: { temperature: 0.2 },
    });

    const queriesText = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const queries = JSON.parse(queriesText);

    console.log(`[Phase 2] Generated optimal queries:`, queries);

    // 2. Dispatch harvesters for each query
    for (const query of queries) {
      const formattedQuery = `ytsearch10:${query}`;
      console.log(`[Phase 2] Dispatching harvester for: ${formattedQuery}`);
      
      const scraperPath = path.resolve(__dirname, '../../youtube_scraper.py');
      const command = `python "${scraperPath}" --url "${formattedQuery}" --discipline "${discipline}"`;
      
      try {
        const { stdout, stderr } = await execPromise(command);
        console.log(`[+] Harvester success for query: ${query}`);
        // Log a snippet of the output
        console.log(stdout.slice(-200));
      } catch (err) {
        console.error(`[!] Harvester failed for query: ${query}`, err);
      }
    }

    console.log(`[Phase 2] Autonomous ingestion complete for gap: "${knowledgeGap}". The knowledge is now vectorizing into Qdrant.`);
  } catch (error) {
    console.error("[!] Failed during autonomous discovery:", error);
  }
}

// Example usage if run directly
if (require.main === module) {
  const gap = process.argv[2] || "Advanced WebGPU compute shaders for generative art";
  discoverAndIngest(gap, 'CODEX');
}
