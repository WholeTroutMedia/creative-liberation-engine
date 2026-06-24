import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

/**
 * Generates an autonomous, stateless React functional component based on user intent.
 * Enforces Tailwind CSS classes and lucide-react icons exclusively.
 */
export async function generateReactComponent(intent: string, contextString?: string): Promise<string> {
    console.log(`[AURORA:GEN-UI] ▶ Generating dynamic React component for intent: "${intent}"`);

    const systemInstruction = `
You are the Aurora Visual Agent. Your task is to act as an advanced Generative UI pipeline.
You must output ONLY valid, raw TypeScript React (TSX) code for a single, stateless functional component based on the user's intent.

Strict constraints:
1. Output ONLY the code block. No markdown backticks, no explanatory text.
2. The component MUST be default exported.
3. Use ONLY Tailwind CSS utility classes for styling. NEVER write custom CSS.
4. Assume 'lucide-react' is available for icons. Import them normally: \`import { IconName } from 'lucide-react';\`
5. Assume 'framer-motion' is available for animations. Import it normally: \`import { motion } from 'framer-motion';\`
6. The component must be fully responsive (mobile-first approach).
7. If data is needed, mock it beautifully within the component.
8. Prioritize a modern, high-end, glassmorphism or sleek minimalist aesthetic.
`;

    const prompt = `Intent to fulfill:\n${intent}\n\nAdditional Context:\n${contextString || 'None'}`;

    try {
        const response = await ai.models.generateContent({
            model: process.env.GENKIT_PRO_MODEL || 'googleai/gemini-2.5-pro',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.3, // Low temperature for code adherence
            }
        });

        let codeText = response.text || '';
        
        // Sanitize: remove markdown backticks if the model ignores the instruction
        codeText = codeText.replace(/^```(tsx|typescript|ts|javascript|js)?\n/gi, '');
        codeText = codeText.replace(/\n```$/g, '');
        
        console.log(`[AURORA:GEN-UI] ✔ Component generated successfully. Code length: ${codeText.length} chars.`);
        return codeText.trim();
    } catch (error: any) {
        console.error(`[AURORA:GEN-UI] ✖ Code generation failed: ${error.message}`);
        throw new Error(`Failed to generate React component: ${error.message}`);
    }
}
