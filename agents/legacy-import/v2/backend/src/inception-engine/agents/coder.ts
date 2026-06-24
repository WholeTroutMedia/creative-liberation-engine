import { AgentInterface, StageResult } from '../types';
import { anthropic } from '../../core/ai-clients';
import { logger } from '../../core/logger';

class CoderAgent implements AgentInterface {
  async implement(context: Record<string, any>): Promise<StageResult> {
    const startTime = Date.now();
    const architecture = context.architecture?.data;
    const requirements = context.requirements?.data;

    logger.info('Coder agent implementing application', { architecture, requirements });

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 16384,
        messages: [{
          role: 'user',
          content: `Generate production-ready code for this architecture:\n\nRequirements:\n${JSON.stringify(requirements, null, 2)}\n\nArchitecture:\n${JSON.stringify(architecture, null, 2)}\n\nProvide:\n1. Complete file structure
2. All source code files
3. Configuration files
4. Tests
5. Documentation

Respond in JSON format with files array: [{path, content}]`
        }]
      });

      const content = response.content[0];
      const implementation = content.type === 'text' ? JSON.parse(content.text) : {};

      return {
        success: true,
        data: implementation,
        metadata: {
          duration_ms: Date.now() - startTime,
          model_used: 'claude-3-5-sonnet-20241022',
          tokens_used: response.usage?.total_tokens,
          confidence: 0.88
        }
      };
    } catch (error) {
      logger.error('Code implementation failed', { error });
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

export const coderAgent = new CoderAgent();
