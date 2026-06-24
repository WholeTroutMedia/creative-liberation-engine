import { ALFREDTeachBackFlow } from './src/flows/informal-agents';
import { configureGenkit } from '@genkit-ai/core';
import { googleAI } from '@genkit-ai/googleai';

// Initialize Genkit if needed
configureGenkit({
  plugins: [googleAI()],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

async function main() {
    const syllabus = `
# Generative AI & Prompt Engineering
**Instructor:** Dr. Giancarlo Crocetti
**Duration:** 2h

### Module 1: Introduction to Generative AI
- What is Generative AI?
- How good is GenAI?
- Bias in Generative AI

### Module 2: The Basics of Prompt Engineering
- Anatomy of a good prompt
- Zero-shot and few-shot prompting
- Chain of Thought (CoT) prompting
    `;

    console.log("Calling ALFREDTeachBackFlow...");
    try {
        const response = await ALFREDTeachBackFlow({
            courseTitle: "Generative AI & Prompt Engineering",
            syllabusContent: syllabus,
            moduleType: "quiz"
        });
        console.log("Response:", response);
    } catch(err) {
        console.error("Error:", err);
    }
}

main();
