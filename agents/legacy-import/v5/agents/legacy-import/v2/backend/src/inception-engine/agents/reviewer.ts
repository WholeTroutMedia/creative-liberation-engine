import { AgentInterface, StageResult } from '../types';
import { anthropic } from '../../core/ai-clients';
import { logger } from '../../core/logger';

class ReviewerAgent implements AgentInterface {
  async review(context: Record<string, any>): Promise<StageResult> {
    const startTime = Date.now();
    const implementation = context.implementation?.data;

    logger.info('Reviewer agent reviewing code', { fileCount: implementation?.files?.length });

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: `Review this implementation for quality and completeness:\n\n${JSON.stringify(implementation, null, 2)}\n\nCheck:\n1. Code quality
2. Best practices
3. Security
4. Performance
5. Test coverage
6. Documentation

Provide detailed review with pass/fail for each category.`
        }]
      });

      const content = response.content[0];
      const review = content.type === 'text' ? JSON.parse(content.text) : {};

      return {
        success: true,
        data: review,
        metadata: {
          duration_ms: Date.now() - startTime,
          model_used: 'claude-3-5-sonnet-20241022',
          tokens_used: response.usage?.total_tokens,
          confidence: 0.90
        }
      };
    } catch (error) {
      logger.error('Code review failed', { error });
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

export const reviewerAgent = new ReviewerAgent();
