import { Injectable, Logger } from '@nestjs/common';

export interface AIProviderResponse {
  text: string;
  tokensUsed: number;
  cost: number;
  latencyMs: number;
  model: string;
}

@Injectable()
export class OpenAIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly baseUrl = 'https://api.openai.com/v1';

  private readonly MODEL_COSTS: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.00001, output: 0.00003 },
    'gpt-4o-mini': { input: 0.0000015, output: 0.000006 },
    'gpt-4-turbo': { input: 0.00001, output: 0.00003 },
    'gpt-3.5-turbo': { input: 0.0000005, output: 0.0000015 },
  };

  async generate(
    prompt: string,
    systemPrompt: string,
    model: string = 'gpt-4o',
    maxTokens: number = 2048,
  ): Promise<AIProviderResponse> {
    const startTime = Date.now();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;
    const tokensUsed = data.usage?.total_tokens || 0;
    const costs = this.MODEL_COSTS[model] || this.MODEL_COSTS['gpt-4o'];
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    const cost = inputTokens * costs.input + outputTokens * costs.output;

    return {
      text: data.choices?.[0]?.message?.content || '',
      tokensUsed,
      cost,
      latencyMs,
      model: data.model || model,
    };
  }

  async generateImage(prompt: string, size: string = '1024x1024'): Promise<string> {
    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        n: 1,
        size,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Image API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data?.[0]?.url || '';
  }
}
