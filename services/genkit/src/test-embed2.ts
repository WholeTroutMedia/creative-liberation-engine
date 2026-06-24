import 'dotenv/config';
import { ai } from './index.js';
import { ollama } from 'genkitx-ollama';

async function main() {
    try {
        console.log("Embedding with model: ollama/nomic-embed-text");
        const res = await ai.embed({
            embedder: "ollama/nomic-embed-text",
            content: "hello world"
        });
        console.log("Embedding size:", res.length);
        console.log("First 5 floats:", res.slice(0, 5));
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
