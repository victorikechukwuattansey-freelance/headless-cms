import { recordAiUsage } from '../observability/metrics.js';
import { createAiProvider, type ChatMessage } from '../ai/provider.js';

export type { ChatMessage };

export const openai = {
  async complete(input: { model: string; organizationId: string; messages: ChatMessage[] }): Promise<string> {
    const result = await createAiProvider().complete({ model: input.model, messages: input.messages });
    recordAiUsage(input.organizationId, input.model, result.tokensIn, result.tokensOut);
    return result.content;
  },
};