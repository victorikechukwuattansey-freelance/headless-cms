import { estimateTokens, type AiCompletion, type AiProvider, type ChatMessage } from './provider.js';

function cannedReply(messages: ChatMessage[], model: string): string {
  const lastUser = [...messages].reverse().find((message) => message.role === 'user');
  return `Mock ${model} response for: ${lastUser?.content ?? 'no user message'}`;
}

export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async complete(input: { model: string; messages: ChatMessage[] }): Promise<AiCompletion> {
    const content = cannedReply(input.messages, input.model);
    const tokensIn = input.messages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
    const tokensOut = estimateTokens(content);
    return { content, tokensIn, tokensOut };
  }
}
