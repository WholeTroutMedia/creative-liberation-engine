import { BlenderGenerativeArtFlow } from './src/flows/blender-generative-art.js';

async function test() {
    try {
        console.log("Calling flow...");
        const res = await BlenderGenerativeArtFlow({
            prompt: "A crystalline structure glowing with neon pink internal light, slowly spinning in a dark void",
            durationSeconds: 2,
            sessionId: "spin-test-01",
            format: "vertical",
            fps: 30,
            renderer: "CYCLES"
        });
        console.log("Result:", res);
    } catch (e) {
        console.error("FLOW THREW ERROR:", e);
    }
}

test();
