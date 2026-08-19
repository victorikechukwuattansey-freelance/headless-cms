import OpenAI from 'openai';
import { estimateTokens, type AiCompletion, type AiProvider, type ChatMessage } from './provider.js';
import { structuredLogger } from '../observability/logger.js';

export interface OpenAiProviderOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  requestsPerSecond?: number;
  burstSize?: number;
  client?: OpenAI;
}

interface RateLimitError {
  status?: number;
}

class TokenBucket {
  private tokens: number;
  private lastRefill = Date.now();

  constructor(private readonly capacity: number, private readonly refillPerMs: number) {
    this.tokens = capacity;
  }

  async take(): Promise<void> {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + (now - this.lastRefill) * this.refillPerMs);
    this.lastRefill = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = (1 - this.tokens) / this.refillPerMs;
    this.tokens = 0;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly timeoutMs: number;
  private readonly bucket: TokenBucket;

  constructor(apiKey: string, options: OpenAiProviderOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 250;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    const requestsPerSecond = options.requestsPerSecond ?? 10;
    const burstSize = options.burstSize ?? 20;
    this.bucket = new TokenBucket(burstSize, requestsPerSecond / 1000);
    this.client = options.client ?? new OpenAI({ apiKey, timeout: this.timeoutMs, maxRetries: 0 });
  }

  async complete(input: { model: string; messages: ChatMessage[] }): Promise<AiCompletion> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      await this.bucket.take();
      try {
        const completion = await this.client.chat.completions.create({
          model: input.model,
          messages: input.messages as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        });
        const content = completion.choices[0]?.message?.content ?? '';
        return {
          content,
          tokensIn: completion.usage?.prompt_tokens ?? estimateTokens(
            input.messages.reduce((sum, message) => sum + message.content, ''),
          ),
          tokensOut: completion.usage?.completion_tokens ?? estimateTokens(content),
        };
      } catch (err) {
        lastError = err;
        const status = (err as RateLimitError).status ?? 0;
        const retryable = status === 429 || status >= 500;
        if (!retryable || attempt === this.maxRetries) {
          break;
        }
        const delay = this.baseDelayMs * 2 ** attempt + Math.random() * 50;
        structuredLogger.warn('ai.provider.retry', {
          model: input.model,
          attempt: attempt + 1,
          status,
          delayMs: Math.round(delay),
        });
        await sleep(delay);
      }
    }
    throw lastError;
  }
}
