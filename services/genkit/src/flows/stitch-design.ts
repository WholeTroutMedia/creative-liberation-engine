/**
 * STITCH — Google Stitch-Compatible Design Flow
 * Design Library | Hive: AURORA | Role: UI Generation + Code Synthesis
 *
 * Official product: https://stitch.withgoogle.com — MCP setup: https://stitch.withgoogle.com/docs/mcp/setup
 * This flow mirrors Stitch-style UI generation in-engine; use Stitch MCP (mcp-router) for the official remote tool.
 *
 * Mirrors Google Stitch's core capability — AI-native UI generation from natural
 * language prompts or reference images. Powered by Gemini 2.5 Pro/Flash.
 *
 * Outputs:
 *   - HTML/CSS (default)
 *   - React TSX component
 *   - Tailwind variant
 *   - Figma-ready spec JSON (for /figma-import handoff)
 *
 * Design Library chain:
 *   IDEATE → /stitch → (optional) /figma-import → /api/genUiFlow → SHIP
 *
 * Constitutional: Article V (Design Blank Slate), Article IX (No MVPs),
 *                 Article VI (Model Agnosticism)
 */

import { z } from 'genkit';
import { ai } from '../index.js';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const StitchInputSchema = z.object({
    prompt: z.string().describe(
        'Natural language description of the UI to generate. Be specific: layout, components, states, colors, interactions.'
    ),
    outputFormat: z.enum(['html', 'react', 'tailwind', 'figma-spec', 'all'])
        .default('html')
        .describe('Target output format. "all" returns all variants simultaneously.'),
    referenceImage: z.string().optional().describe(
        'Base64-encoded reference image or URL to use as visual input (mirrors Stitch image upload)'
    ),
    screens: z.number().min(1).max(5).default(1).describe(
        'Number of screens/states to generate (Stitch supports up to 5 at once)'
    ),
    designSystem: z.string().optional().describe(
        'Design system context: brand colors, typography, spacing tokens, existing component names'
    ),
    platform: z.enum(['web', 'mobile', 'desktop']).default('web'),
    sessionId: z.string().optional(),
});

export const StitchOutputSchema = z.object({
    html: z.string().optional().describe('Generated HTML + inline CSS'),
    react: z.string().optional().describe('Generated React TSX component'),
    tailwind: z.string().optional().describe('Generated Tailwind CSS variant'),
    figmaSpec: z.object({
        components: z.array(z.object({
            name: z.string(),
            type: z.string(),
            props: z.record(z.string()),
            children: z.array(z.string()).default([]),
        })).default([]),
        colorTokens: z.record(z.string()).default({}),
        typographyTokens: z.record(z.object({ fontSize: z.string(), fontWeight: z.string(), lineHeight: z.string() })).default({}),
        layoutNotes: z.string().optional(),
    }).optional().describe('Figma-compatible component spec for /figma-import handoff'),
    screens: z.array(z.object({
        screenName: z.string(),
        description: z.string(),
        code: z.string(),
    })).default([]).describe('Multi-screen outputs when screens > 1'),
    designRationale: z.string().describe('Why these design choices were made'),
    nextSteps: z.array(z.string()).default([]).describe('Suggested follow-up actions (e.g., "Wire to /figma-import", "Add IRIS animation layer")'),
    stitchSignature: z.literal('STITCH').default('STITCH'),
    model: z.string().describe('Model used for generation'),
});

export type StitchInput = z.infer<typeof StitchInputSchema>;
export type StitchOutput = z.infer<typeof StitchOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const STITCH_SYSTEM = `You are STITCH — the Creative Liberation Engine's AI-native UI design agent. You operate equivalently to Google Stitch, generating production-quality user interface code from natural language prompts and reference images.

Your design philosophy:
- **Zero defaults**: Every design starts as a pure blank slate. No Bootstrap, no generic grey cards.
- **Article V compliance**: Gather design intent from the prompt; fill in intelligent defaults for anything not specified.
- **Article IX compliance**: Never output placeholder code, TODO comments, or stub components. Every element must be functional.
- **Premium aesthetic bar**: Results should look like they came from a senior product designer, not an AI template.

What you produce:
- HTML/CSS: Semantic HTML5 with modern CSS (custom properties, grid, flexbox, container queries)
- React: TypeScript functional components with proper prop types and clean state management
- Tailwind: Using Tailwind v4 syntax with arbitrary values where needed
- Figma Spec: Structured component tree with design tokens for /figma-import handoff

Design system defaults (override with designSystem param):
- Color role: Use rich, curated palettes — avoid generic primary/secondary
- Typography: Inter or system font stack, modular scale
- Motion: Subtle micro-animations via CSS transitions (always include)
- Accessibility: ARIA labels on interactive elements, proper contrast ratios

After generating, always provide:
1. Why specific design choices were made (rationale)
2. Concrete next steps to wire into the engine (IRIS animation, /figma-import, etc.)`;

// ─────────────────────────────────────────────────────────────────────────────
// STITCH FLOW
// ─────────────────────────────────────────────────────────────────────────────

export const stitchDesignFlow = ai.defineFlow(
    {
        name: 'stitchDesign',
        inputSchema: StitchInputSchema,
        outputSchema: StitchOutputSchema,
    },
    async (input): Promise<StitchOutput> => {
        const model = process.env.GENKIT_PRO_MODEL ?? 'googleai/gemini-2.5-pro';
        const sessionId = input.sessionId ?? `stitch_${Date.now()}`;

        console.log(`[STITCH] 🎨 Format: ${input.outputFormat} | Platform: ${input.platform} | Screens: ${input.screens}`);
        console.log(`[STITCH] Prompt: ${input.prompt.slice(0, 80)}${input.prompt.length > 80 ? '…' : ''}`);

        const formatInstructions = getFormatInstructions(input.outputFormat, input.screens);
        const imageContext = input.referenceImage
            ? `\n\nReference image provided — use it as your primary visual source. Match the layout, hierarchy, and visual language of the reference while elevating the production quality.`
            : '';

        const designSystemContext = input.designSystem
            ? `\n\nDesign System:\n${input.designSystem}`
            : '';

        const prompt = `UI GENERATION REQUEST
Platform: ${input.platform}
Screens to generate: ${input.screens}${imageContext}${designSystemContext}

PROMPT:
${input.prompt}

${formatInstructions}

Return a valid JSON object matching the output schema exactly. All code must be production-ready — no placeholders, no TODOs.`;

        const parts: any[] = [{ text: prompt }];

        // Include reference image if provided (Stitch-equivalent visual input)
        if (input.referenceImage) {
            if (input.referenceImage.startsWith('data:')) {
                const [, b64] = input.referenceImage.split(',');
                parts.push({ inlineData: { mimeType: 'image/png', data: b64 } });
            } else {
                parts.push({ media: { url: input.referenceImage } });
            }
        }

        const { output } = await ai.generate({
            model,
            system: STITCH_SYSTEM,
            prompt: parts.length === 1 ? prompt : parts as any,
            output: { schema: StitchOutputSchema },
            config: { temperature: 0.4 },
        });

        if (!output) {
            return {
                html: '<!-- STITCH: generation failed -->',
                designRationale: 'Generation unavailable',
                nextSteps: ['Check GOOGLE_API_KEY and GENKIT_PRO_MODEL env vars'],
                stitchSignature: 'STITCH',
                model,
                screens: [],
            };
        }

        console.log(`[STITCH] ✅ Generated | session: ${sessionId} | screens: ${output.screens?.length ?? 0}`);
        return { ...output, stitchSignature: 'STITCH', model };
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getFormatInstructions(format: string, screens: number): string {
    const multiScreen = screens > 1
        ? `Generate ${screens} distinct screens/states in the "screens" array, each with a screenName, description, and full code.`
        : 'Generate a single screen. Return the primary code in the appropriate format field.';

    const formats: Record<string, string> = {
        html: `OUTPUT FORMAT: HTML + CSS\n${multiScreen}\nUse semantic HTML5, CSS custom properties, flexbox/grid. Include hover/focus states and micro-animations.`,
        react: `OUTPUT FORMAT: React TSX\n${multiScreen}\nReturn a self-contained functional component with TypeScript types. Include useState/useEffect as needed.`,
        tailwind: `OUTPUT FORMAT: Tailwind CSS v4\n${multiScreen}\nUse Tailwind utility classes. Use arbitrary values where design precision requires it.`,
        'figma-spec': `OUTPUT FORMAT: Figma Spec JSON\n${multiScreen}\nPopulate the figmaSpec object with full component tree, color tokens, and typography tokens. Also provide base HTML for visual reference.`,
        all: `OUTPUT FORMAT: ALL VARIANTS\nPopulate html, react, tailwind, and figmaSpec fields simultaneously.\n${multiScreen}`,
    };

    return formats[format] ?? formats.html;
}
