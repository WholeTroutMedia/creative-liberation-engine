import 'dotenv/config';
import { ai, LOCAL_MODEL_IDS } from './index.js';

async function main() {
    try {
        console.log("Embedding with model:", LOCAL_MODEL_IDS.embed);
        const res = await ai.embed({
            embedder: LOCAL_MODEL_IDS.embed,
            content: "hello world"
        });
        console.log("Embedding size:", res.length);
        console.log("First 5 floats:", res.slice(0, 5));
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
