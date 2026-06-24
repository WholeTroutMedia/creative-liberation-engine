import { AgentInterface, StageResult } from '../types';
import { anthropic } from '../../core/ai-clients';
import { logger } from '../../core/logger';

class ArchitectAgent implements AgentInterface {
  async generate(context: Record<string, any>): Promise<StageResult> {
    const startTime = Date.now();
    const requirements = context.requirements?.data;

    logger.info('Architect agent generating architecture', { requirements });

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: `Design system architecture for these requirements:\n\n${JSON.stringify(requirements, null, 2)}\n\nProvide:\n1. Technology stack
2. System components
3. Data models
4. API structure
5. Deployment strategy
6. Security considerations

Respond in JSON format with complete architecture specification.`
        }]
      });

      const content = response.content[0];
      const architecture = content.type === 'text' ? JSON.parse(content.text) : {};

      return {
        success: true,
        data: architecture,
        metadata: {
          duration_ms: Date.now() - startTime,
          model_used: 'claude-3-5-sonnet-20241022',
          tokens_used: response.usage?.total_tokens,
          confidence: 0.92
        }
      };
    } catch (error) {
      logger.error('Architecture generation failed', { error });
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

export const architectAgent = new ArchitectAgent();
