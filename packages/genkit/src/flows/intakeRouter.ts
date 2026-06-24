import { z } from 'genkit';
import { ai } from '../index.js';
import { withHumanState } from './biometric-context.js';
// Define the input and output schemas
export const IntakeRouterInputSchema = z.object({
    text: z.string(),
    timestampMs: z.number()
});

export const IntakeRouterOutputSchema = z.object({
    intent: z.enum(['chat', 'media_context']),
    eventSlug: z.string().optional().describe('A filename-safe, snake_case or PascalCase short string summarizing the event if this is a media context log (e.g., Brooks_Interview). Empty if intent=chat.'),
    preBufferMinutes: z.number().optional().describe('How many minutes BEFORE the timestamp should the Gravity Well start? Default to 15 if not specified by user.'),
    postBufferMinutes: z.number().optional().describe('How many minutes AFTER the timestamp should the Gravity Well extend? Default to 30 if not specified by user.'),
    replyMsg: z.string().describe('A very short, 1-sentence reply to the user. E.g., "Context anchor dropped for Brooks Interview."')
});

/**
 * Intake Router Flow
 * Classifies a raw voice log from the user in the field.
 * Determines if it's a general question (chat) or a command to file/organize media (media_context).
 */
export const intakeRouterFlow = ai.defineFlow({
    name: 'intakeRouterFlow',
    inputSchema: IntakeRouterInputSchema,
    outputSchema: IntakeRouterOutputSchema,
}, async (input) => {
    
    // Use structured output to force the LLM to return our exact schema
    const promptRef = `
You are the Zero-Day Intake Router for the Creative Liberation Engine. 
Artist is in the field, wearing a microphone or Apple Watch. He just dictated the following voice note:

"${input.text}"

Your job is to determine his intent:
1. Is he asking a general question, brainstorming, or trying to converse? -> INTENT = 'chat'
2. Is he providing context for a film shoot, dropping a marker, leaving a field note for the editor, or mentioning an event/interview that is being recorded? -> INTENT = 'media_context'

If INTENT is 'media_context':
- Generate a clean, short \`eventSlug\` for the folder name (e.g. "Brooks_Interview").
- Try to infer if he wants a specific time window. If he says "for the last 5 minutes", set preBufferMinutes=5. If he says nothing about time, leave buffer fields undefined so they use defaults.
- \`replyMsg\` should be a short confirmation like "Anchor dropped for [Slug]."

If INTENT is 'chat':
- Provide a brief, helpful answer in \`replyMsg\`.
`;

    const result = await ai.generate(await withHumanState({
        model: process.env.MODEL_EDGE || process.env.GENKIT_DEFAULT_MODEL || 'gemini-2.5-flash',
        prompt: promptRef,
        output: { schema: IntakeRouterOutputSchema }
    }));

    if (result.output) {
        return result.output;
    } else {
        throw new Error("Flow failed to generate structured output for IntakeRouter.");
    }
});
