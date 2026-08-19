import { MockAiProvider } from './mock-provider.js';
import { OpenAiProvider } from './openai-provider.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletion {
  content: string;
  tokensIn: number;
  tokensOut: number;
}

export interface AiProvider {
  readonly name: string;
  complete(input: { model: string; messages: ChatMessage[] }): Promise<AiCompletion>;
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function createAiProvider(apiKey?: string, environment?: string): AiProvider {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    if (environment === 'production' || process.env.NODE_ENV === 'production') {
      throw new Error('OPENAI_API_KEY is required in production');
    }
    return new MockAiProvider();
  }
  return new OpenAiProvider(key);
}
