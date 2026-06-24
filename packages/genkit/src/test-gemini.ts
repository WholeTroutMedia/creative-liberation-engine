import { z } from 'genkit';
import { ai } from './ai.js';

async function test() {
    try {
        console.log("Calling Gemini 2.5 Flash via googleai provider...");
        const response = await ai.generate({
            model: 'googleai/gemini-2.5-flash',
            prompt: 'Hello, respond with a JSON object containing "greeting": "hello".',
            output: {
                schema: z.object({
                    greeting: z.string().describe('A friendly greeting')
                })
            }
        });
        console.log("Success:", JSON.stringify(response.output));
    } catch (err: any) {
        console.error("Error:", err.message);
        console.error(err.stack);
    }
}

test();
