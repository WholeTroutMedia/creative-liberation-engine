import fs from 'fs';
import path from 'path';
import { generateCMX3600EDL } from '../spikes/isaac-edl-generator.mjs';

const ISAAC_ENDPOINT = process.env.ISAAC_ENDPOINT || 'http://127.0.0.1:8000/v1/chat/completions';
const MODEL_NAME = 'PerceptronAI/Isaac-0.1';

/**
 * Invokes the local Isaac model via HTTP to analyze video frames.
 * Returns a JSON payload conforming to VIDEO_ANALYSIS_RESULT.schema.json
 */
export async function analyzeVideoWithIsaac(videoReference, base64Frames) {
    console.log(`[Isaac Analyzer] Invoking local model ${MODEL_NAME} at ${ISAAC_ENDPOINT}`);

    // Construct OpenAI-compatible vision payload
    const contentPayload = [
        {
            type: "text",
            text: "Analyze these video keyframes. Provide a detailed JSON response identifying events, timecodes, descriptions, and physical properties (like energy_level). Respond ONLY with valid JSON conforming to the VIDEO_ANALYSIS_RESULT schema."
        }
    ];

    // Append all frames to the payload
    base64Frames.forEach(frame => {
        contentPayload.push({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${frame}` }
        });
    });

    try {
        const response = await fetch(ISAAC_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Local vLLM requires a Bearer token header even if empty
                'Authorization': `Bearer local-isaac-key`
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    {
                        role: "user",
                        content: contentPayload
                    }
                ],
                temperature: 0.2,
                max_tokens: 2048,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Isaac Model HTTP Error: ${response.status} ${errBody}`);
        }

        const data = await response.json();
        const rawJson = data.choices[0].message.content;
        
        let parsedResult;
        try {
            parsedResult = JSON.parse(rawJson);
        } catch (e) {
            console.error("[Isaac Analyzer] Failed to parse model output as JSON:", rawJson);
            throw e;
        }

        // Add metadata to the schema
        parsedResult.timestamp = new Date().toISOString();
        parsedResult.model = MODEL_NAME;
        parsedResult.video_reference = videoReference;

        return parsedResult;

    } catch (error) {
        console.error(`[Isaac Analyzer] Failed to analyze video:`, error.message);
        throw error;
    }
}

/**
 * Main pipeline function to process a video and generate an EDL
 */
export async function runContentFoundryPipeline(videoPath, mockFrames = []) {
    console.log(`[Content Foundry] Starting analysis pipeline for: ${videoPath}`);
    
    // In a production environment, we would use ffmpeg to extract frames.
    // For this implementation, we assume mockFrames are provided if no ffmpeg is setup.
    const frames = mockFrames.length > 0 ? mockFrames : ["mock_base64_frame_data"];

    try {
        const analysisResult = await analyzeVideoWithIsaac(path.basename(videoPath), frames);
        console.log(`[Content Foundry] Analysis complete. Generating EDL...`);
        
        const edl = generateCMX3600EDL(analysisResult, 'CAM_A', 24);
        
        const outputDir = path.dirname(videoPath);
        const edlPath = path.join(outputDir, `${path.basename(videoPath, path.extname(videoPath))}.edl`);
        
        fs.writeFileSync(edlPath, edl);
        console.log(`[Content Foundry] EDL saved to: ${edlPath}`);
        
        return {
            status: "success",
            analysis: analysisResult,
            edlPath
        };

    } catch (error) {
        console.error(`[Content Foundry] Pipeline failed:`, error);
        return {
            status: "error",
            error: error.message
        };
    }
}
