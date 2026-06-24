
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Dynamically generated agent: VERA
// Skills: 

const ai = genkit({
    plugins: [googleAI()],
    model: process.env.GENKIT_DEFAULT_MODEL ?? 'googleai/gemini-2.5-flash'
});

console.log('[RUNTIME] Agent VERA online on port 4992');

// CLE ZERO DAY dispatch mapping would connect here
