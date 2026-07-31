import { Injectable, Logger } from '@nestjs/common';
import { AIProviderResponse } from './openai.provider';

@Injectable()
export class AnthropicProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly baseUrl = 'https://api.anthropic.com/v1';

  private readonly MODEL_COSTS: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-20250514': { input: 0.000003, output: 0.000015 },
    'claude-3-5-haiku-20241022': { input: 0.0000008, output: 0.000004 },
    'claude-3-opus-20240229': { input: 0.000015, output: 0.000075 },
  };

  async generate(
    prompt: string,
    systemPrompt: string,
    model: string = 'claude-sonnet-4-20250514',
    maxTokens: number = 2048,
  ): Promise<AIProviderResponse> {
    const startTime = Date.now();

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;
    const costs = this.MODEL_COSTS[model] || this.MODEL_COSTS['claude-sonnet-4-20250514'];
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const tokensUsed = inputTokens + outputTokens;
    const cost = inputTokens * costs.input + outputTokens * costs.output;

    return {
      text: data.content?.[0]?.text || '',
      tokensUsed,
      cost,
      latencyMs,
      model: data.model || model,
    };
  }
}
