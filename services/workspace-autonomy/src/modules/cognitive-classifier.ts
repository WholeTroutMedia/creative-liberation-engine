/**
 * Sovereign Cognitive Classifier — Helix γ
 * Classifies incoming digital signals (emails, chats, alerts) against the V6 Cognitive Routing Matrix:
 *   - Axis A: Intent Type (TASK vs. CONVERSATION)
 *   - Axis B: Creative Phase (BRAINSTORM vs. IDEATION)
 * Leverages local-first Ollama reasoning models.
 */
import * as fs from 'fs';
import * as path from 'path';

export interface SignalClassification {
  intentType: 'TASK' | 'CONVERSATION';
  creativePhase: 'BRAINSTORM' | 'IDEATION';
  primaryObjective: string;
  suggestedRouting: string;
  reasoning: string;
}

export class CognitiveClassifier {
  private ollamaUrl: string;
  private modelName: string;

  constructor(ollamaUrl = 'http://127.0.0.1:11434', modelName = 'deepseek-r1:8b') {
    this.ollamaUrl = ollamaUrl;
    this.modelName = modelName;
  }

  /**
   * Evaluates an incoming message body and subject
   */
  public async classify(subject: string, bodyText: string): Promise<SignalClassification> {
    console.log(`[Cognitive Classifier] Classifying signal: "${subject}"...`);

    const prompt = `Analyze this incoming message and classify it against these two operational axes:

1. Axis A: Intent Type
   - TASK: Direct command or action item. Modifies files, runs scripts, deploys services, requires done-when assertions.
   - CONVERSATION: Open-ended dialog, general question, greeting, check-in, or relational feedback. Read-only context retrieval.

2. Axis B: Creative Phase
   - BRAINSTORM: Divergent exploration, hypothetical, blue-sky ideas, unconstrained analogies ("what if we combined X and Y").
   - IDEATION: Convergent planning, formal workstream targets, contract mapping, structured next steps.

Message Subject: ${subject}
Message Body:
${bodyText}

Respond strictly in valid JSON format. Do not include any reasoning thoughts or wrappers outside of the JSON. The JSON structure must match this:
{
  "intentType": "TASK" or "CONVERSATION",
  "creativePhase": "BRAINSTORM" or "IDEATION",
  "primaryObjective": "A clear one-sentence summary of the user objective",
  "suggestedRouting": "Where to direct this in the Creative Liberation Engine OS",
  "reasoning": "Brief technical logic for this classification"
}`;

    try {
      const response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          options: { temperature: 0.1 }
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        let content = data.message?.content || '';
        
        // Remove deepseek thoughts if present (<think>...</think>)
        content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        // Safe JSON parsing
        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            intentType: parsed.intentType === 'TASK' ? 'TASK' : 'CONVERSATION',
            creativePhase: parsed.creativePhase === 'IDEATION' ? 'IDEATION' : 'BRAINSTORM',
            primaryObjective: parsed.primaryObjective || 'None',
            suggestedRouting: parsed.suggestedRouting || 'General',
            reasoning: parsed.reasoning || 'No details'
          };
        }
      }
    } catch (e) {
      console.warn('[Cognitive Classifier] Local LLM unavailable, using rules-based heuristics fallback:', e);
    }

    // Rules-Based Heuristic Fallback (Resilient Engineering)
    return this.heuristicFallback(subject, bodyText);
  }

  /**
   * Safe, zero-dependency rules engine for fallback classification
   */
  private heuristicFallback(subject: string, bodyText: string): SignalClassification {
    const s = (subject + ' ' + bodyText).toLowerCase();
    
    let intentType: 'TASK' | 'CONVERSATION' = 'CONVERSATION';
    let creativePhase: 'BRAINSTORM' | 'IDEATION' = 'BRAINSTORM';
    
    // Task check
    if (
      s.includes('deploy') || s.includes('run') || s.includes('compile') || 
      s.includes('test') || s.includes('fix') || s.includes('create') || 
      s.includes('scaffold') || s.includes('update')
    ) {
      intentType = 'TASK';
    }

    // Ideation check
    if (s.includes('briefing') || s.includes('idx-') || s.includes('workstream') || s.includes('agenda')) {
      creativePhase = 'IDEATION';
    }

    return {
      intentType,
      creativePhase,
      primaryObjective: subject.slice(0, 80),
      suggestedRouting: intentType === 'TASK' ? 'DISPATCH' : 'CORTEX_CHAT',
      reasoning: 'Classified via rules-based heuristic fallback engine.'
    };
  }
}
