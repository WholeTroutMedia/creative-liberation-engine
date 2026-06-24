import { MetaOrchestrator } from './meta-orchestrator';

/**
 * Creative Liberation Engine - Main Orchestration Entry Point
 * This daemon listens for incoming high-level tasks and pushes them
 * through the Meta-Orchestrator to break the conversational paradigm.
 */

async function main() {
    const rawArgs = process.argv.slice(2);
    const prompt = rawArgs.join(' ') || 'Generate a cinematic trailer for Creative Liberation Engine V6 using Kling and Foley.';
    
    console.log('--- CLE ENGINE: META-ORCHESTRATOR BOOT ---');
    const orchestrator = new MetaOrchestrator(prompt);
    
    // The execution loop runs autonomously, discovering skills, creating agents, and dispatching.
    const finalState = await orchestrator.executeLoop();
    
    console.log('--- ORCHESTRATION COMPLETE ---');
    console.log(JSON.stringify(finalState, null, 2));
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal Orchestration Error:', err);
        process.exit(1);
    });
}
