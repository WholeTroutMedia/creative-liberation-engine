import { z } from 'genkit';
import { ai } from '../index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveModel } from '../config/model-registry.js';

export const BarnstormVideoFlow = ai.defineFlow(
    {
        name: 'BarnstormVideoIntel',
        inputSchema: z.object({
            message: z.string().describe('The user query regarding the video'),
            videoUrl: z.string().describe('The URL of the video to analyze'),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        console.log(`[BARNSTORM] 🎬 Analyzing video for query: "${input.message}"`);
        
        // 1. Download the video to a temporary file so Genkit can use local file uploading
        const tmpPath = path.join(os.tmpdir(), 'barnstorm_sample.mp4');
        try {
            console.log(`[BARNSTORM] Downloading video from ${input.videoUrl} to ${tmpPath}...`);
            const res = await fetch(input.videoUrl);
            if (!res.ok) throw new Error(`Failed to fetch video: ${res.statusText}`);
            const buffer = await res.arrayBuffer();
            fs.writeFileSync(tmpPath, Buffer.from(buffer));
            console.log(`[BARNSTORM] Download complete.`);
        } catch (err) {
            console.error(`[BARNSTORM] Failed to download video. Using fallback path. Error: ${err}`);
        }

        const promptText = `You are a professional video analyst. The user has asked: "${input.message}"
You need to analyze the provided video and return a precise JSON array of matches that visually or semantically relate to the user's query.
Format the output as a JSON object containing a "reply" string (a brief conversational answer) and a "matches" array.
Each match should have:
- "start": string (e.g. "00:05")
- "end": string (e.g. "00:15")
- "time": string (same as start, for timeline clicking)
- "desc": string (brief description of what happens)
- "confidence": number (between 0.0 and 1.0)

Example JSON Output:
{
  "reply": "I found a few moments that match your query.",
  "matches": [
    { "start": "00:06", "end": "00:15", "time": "00:06", "desc": "Lighting rig is adjusted on stage left", "confidence": 0.94 }
  ]
}`;

        console.log("🧠 Transmitting multimodal payload to Gemini 1.5 Pro...");

        const response = await ai.generate({
            model: resolveModel('cloud:fast'),
            messages: [
                {
                    role: 'user',
                    content: [
                        { text: promptText },
                        {
                            media: {
                                url: `file://${tmpPath.replace(/\\/g, '/')}`,
                                contentType: 'video/mp4'
                            }
                        }
                    ]
                }
            ],
            output: { format: 'json' },
            config: {
                temperature: 0.2,
            }
        });

        try {
            console.log(`✅ Barnstorm Video Analysis complete.`);
            return JSON.parse(response.text);
        } catch (e) {
            console.error("[BARNSTORM] Failed to parse output:", e);
            throw e;
        }
    }
);
