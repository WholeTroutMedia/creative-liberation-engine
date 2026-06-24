import { AgentInterface, StageResult } from '../types';
import { anthropic } from '../../core/ai-clients';
import { logger } from '../../core/logger';

class RequirementsAgent implements AgentInterface {
  async parse(context: Record<string, any>): Promise<StageResult> {
    const startTime = Date.now();
    const userPrompt = context.user_prompt;

    logger.info('Requirements agent parsing prompt', { prompt: userPrompt });

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Analyze this application idea and extract structured requirements:\n\n${userPrompt}\n\nProvide:\n1. Core features (list)
2. Technical constraints
3. Target users
4. Success criteria
5. Scope boundaries

Respond in JSON format.`
        }]
      });

      const content = response.content[0];
      const requirements = content.type === 'text' ? JSON.parse(content.text) : {};

      return {
        success: true,
        data: requirements,
        metadata: {
          duration_ms: Date.now() - startTime,
          model_used: 'claude-3-5-sonnet-20241022',
          tokens_used: response.usage?.total_tokens,
          confidence: 0.95
        }
      };
    } catch (error) {
      logger.error('Requirements parsing failed', { error });
      return {
        success: false,
        data: { error: error.message },
        metadata: {
          duration_ms: Date.now() - startTime
        }
      };
    }
  }
}

export const requirementsAgent = new RequirementsAgent();
