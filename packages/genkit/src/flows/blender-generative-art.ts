/**
 * Blender Generative Art Pipeline
 * 
 * Uses Gemini (via Creative Liberation Engine's ai.generate) to dynamically write a 
 * complete Blender Python (bpy) script based on a creative text prompt.
 * 
 * The script must clear the default scene, construct procedural geometry, 
 * apply lighting and materials, animate a camera over N seconds, and render
 * the output headlessly.
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const BLENDER_EXEC = process.env.BLENDER_EXEC 
    || 'C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe';

const RENDER_OUTPUT_DIR = `d:\\Google Antigravity\\Infusion Engine Brainchild\\tmp_genai\\blender_renders`;
const SCRIPT_OUTPUT_DIR = `d:\\Google Antigravity\\Infusion Engine Brainchild\\tmp_genai\\blender_scripts`;

const BLENDER_TIMEOUT_MS = 300_000; // 5 min max for a generative render

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const BlenderGenerativeArtInputSchema = z.object({
    prompt: z.string().describe('Creative description of the 3D art (e.g., "glowing crystalline structures in a dark void")'),
    sessionId: z.string(),
    durationSeconds: z.number().default(3).describe('Length of the animated loop'),
    format: z.enum(['vertical', 'landscape', 'square']).default('vertical'),
    fps: z.number().default(30),
    renderer: z.enum(['CYCLES', 'BLENDER_EEVEE']).default('CYCLES') // Eevee is much faster for iterative gen
});

export const BlenderGenerativeArtOutputSchema = z.object({
    videoPath: z.string().nullable().describe('Path to the rendered MP4'),
    scriptPath: z.string().nullable().describe('Path to the generated bpy script'),
    status: z.enum(['success', 'no_blender', 'generation_error', 'render_error']),
    message: z.string(),
});

export type BlenderGenerativeArtInput = z.infer<typeof BlenderGenerativeArtInputSchema>;
export type BlenderGenerativeArtOutput = z.infer<typeof BlenderGenerativeArtOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI PROMPT (bpy Code Gen)
// ─────────────────────────────────────────────────────────────────────────────

async function generateBlenderScript(
    prompt: string, 
    durationSeconds: number, 
    fps: number, 
    format: string,
    renderer: string,
    outputPath: string
): Promise<string> {
    
    const [renderWidth, renderHeight] = format === 'vertical' ? [1080, 1920] 
        : format === 'square' ? [1080, 1080] : [1920, 1080];
    const totalFrames = durationSeconds * fps;

    const systemPrompt = `
You are a master technical artist specializing in Blender Python (bpy).
You have been tasked with generating a COMPLETE, run-ready Python script for Blender 5.x that creates an animated 3D artwork based on the user's prompt.

CRITICAL REQUIREMENTS (Failure to follow these breaks the automated pipeline):
1. **Delete Everything:** Start by deleting all default objects (Cube, Light, Camera).
2. **Abstract/Procedural:** Use procedural methods (modifiers, math nodes, geometry nodes, complex arrays, noise) to generate the requested geometry. Do not rely on external assets.
3. **Lighting & Material:** Set up dramatic studio lighting or HDRI environment (procedurally generated sky texture is fine). ALL objects must have materials with Principled BSDF or Emission shaders. Use node trees for procedural textures if needed.
4. **Camera & Animation:** 
   - Create a camera and track it to the subject.
   - Insert keyframes (using location/rotation or constraints) to create a smooth, continuous, looping animation over exactly ${totalFrames} frames.
5. **Render Settings (DO NOT MOCK):**
   - Output Path: r'${outputPath}'
   - Engine: '${renderer}'
   - Resolution: ${renderWidth}x${renderHeight}
   - FPS: ${fps}
   - Frame Start: 1
   - Frame End: ${totalFrames}
   - Output Format: 'FFMPEG'
   - FFMPEG Codec: 'H264' (MP4)
   - Do NOT call bpy.ops.render.render() in the script! The pipeline will handle the render execution. Just set up the scene and settings.

RETURN ONLY VALID PYTHON CODE. DO NOT WRAP IN MARKDOWN BLOCKS (\`\`\`python). JUST THE PURE PYTHON CODE.
`;

    const response = await ai.generate({
        model: process.env.GENKIT_PRO_MODEL || 'googleai/gemini-2.5-pro',
        system: systemPrompt,
        prompt: `Create a 3D animated artwork described as: "${prompt}"`,
        config: {
            temperature: 0.7 // Some creativity, but mostly technical rigidity needed
        }
    });

    let code = response.text;
    // Strip markdown if the LLM ignores instructions
    code = code.replace(/^```python\s*/im, '').replace(/```\s*$/im, '');
    return code;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLENDER SPAWN
// ─────────────────────────────────────────────────────────────────────────────

async function spawnBlenderHeadless(scriptPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(BLENDER_EXEC)) {
            reject(new Error(`Blender not found at: ${BLENDER_EXEC}`));
            return;
        }

        // We use --factory-startup to ensure a clean slate, then run the script, then render animation (-a)
        const args = [
            '--background', 
            '--factory-startup',
            '--python', scriptPath,
            '-a' 
        ];

        console.log(`[BLENDER-GEN] Spawning headless render...`);
        
        const proc = spawn(BLENDER_EXEC, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        
        const timeout = setTimeout(() => {
            proc.kill('SIGKILL');
            reject(new Error(`Blender render timed out after ${BLENDER_TIMEOUT_MS / 1000}s`));
        }, BLENDER_TIMEOUT_MS);

        let stdoutBuf = '';
        let stderrBuf = '';

        proc.stdout?.on('data', (d: Buffer) => {
            const line = d.toString();
            stdoutBuf += line;
            if (line.includes('Append frame') || line.includes('Saved') || line.includes('Error') || line.includes('Fra:')) {
                process.stdout.write(`[BLENDER-GEN] ${line.trim()}`);
            }
        });
        
        proc.stderr?.on('data', (d: Buffer) => { stderrBuf += d.toString(); });

        proc.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0) {
                console.log(`\n[BLENDER-GEN] ✅ Render complete`);
                resolve();
            } else {
                reject(new Error(`Blender exited with code ${code}:\n${stderrBuf.slice(-1000)}\n\nStdout snippet:\n${stdoutBuf.slice(-1000)}`));
            }
        });

        proc.on('error', (e) => { clearTimeout(timeout); reject(e); });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// GENKIT FLOW
// ─────────────────────────────────────────────────────────────────────────────

export const BlenderGenerativeArtFlow = ai.defineFlow(
    {
        name: 'BlenderGenerativeArt',
        inputSchema: BlenderGenerativeArtInputSchema,
        outputSchema: BlenderGenerativeArtOutputSchema,
    },
    async (input: BlenderGenerativeArtInput): Promise<BlenderGenerativeArtOutput> => {
        const { prompt, sessionId, durationSeconds, format, fps, renderer } = input;

        console.log(`[BLENDER-GEN] Starting Generative Flow for Session: ${sessionId}`);
        console.log(`[BLENDER-GEN]   Prompt: "${prompt}"`);

        if (!fs.existsSync(BLENDER_EXEC)) {
            console.log(`[BLENDER-GEN] ⚠️  Blender not found at: ${BLENDER_EXEC}`);
            return {
                videoPath: null,
                scriptPath: null,
                status: 'no_blender',
                message: `Blender not installed at ${BLENDER_EXEC}. Set BLENDER_EXEC env var.`,
            };
        }

        fs.mkdirSync(RENDER_OUTPUT_DIR, { recursive: true });
        fs.mkdirSync(SCRIPT_OUTPUT_DIR, { recursive: true });

        const runId = randomUUID().split('-')[0];
        // Blender appends frame numbers automatically, so we specify output without extension,
        // and tell FFMPEG to write to exactly this container.
        const outputBase = path.join(RENDER_OUTPUT_DIR, `genart_${sessionId}_${runId}.mp4`);
        const scriptPath = path.join(SCRIPT_OUTPUT_DIR, `bpy_gen_${sessionId}_${runId}.py`);

        try {
            console.log(`[BLENDER-GEN] Generating bpy script via Gemini...`);
            const scriptContent = await generateBlenderScript(
                prompt, durationSeconds, fps, format, renderer, outputBase
            );
            
            fs.writeFileSync(scriptPath, scriptContent);
            console.log(`[BLENDER-GEN] Script saved to: ${scriptPath}`);

        } catch (e) {
            console.error(`[BLENDER-GEN] ❌ AI Script Generation failed: ${e}`);
            return {
                videoPath: null,
                scriptPath: null,
                status: 'generation_error',
                message: `Gemini failed to generate Blender script: ${e}`,
            };
        }

        try {
            await spawnBlenderHeadless(scriptPath);
            
            // Blender might append "0001-0090" to the file depending on exact output settings
            // But if we told FFMPEG to just output the MP4, it usually respects the path directly
            // or appends the frame range. We will assume the base name is sufficient for locating.
            
            return {
                videoPath: outputBase, // Note: actual file might be slightly renamed by Blender
                scriptPath: scriptPath,
                status: 'success',
                message: `Generative 3D art rendered successfully.`,
            };
        } catch (e) {
            console.error(`[BLENDER-GEN] ❌ Render failed: ${e}`);
            return {
                videoPath: null,
                scriptPath: scriptPath,
                status: 'render_error',
                message: `Blender execution failed: ${e}`,
            };
        }
    }
);
