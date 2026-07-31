import { Injectable, Logger } from '@nestjs/common';
import { AIProviderResponse } from './openai.provider';

@Injectable()
export class GeminiProvider {
  private readonly logger = new Logger(GeminiProvider.name);

  private readonly MODEL_COSTS: Record<string, { input: number; output: number }> = {
    'gemini-1.5-pro': { input: 0.00000125, output: 0.000005 },
    'gemini-1.5-flash': { input: 0.000000075, output: 0.0000003 },
    'gemini-2.0-flash': { input: 0.0000001, output: 0.0000004 },
  };

  async generate(
    prompt: string,
    systemPrompt: string,
    model: string = 'gemini-1.5-pro',
    maxTokens: number = 2048,
  ): Promise<AIProviderResponse> {
    const startTime = Date.now();
    const apiKey = process.env.GEMINI_API_KEY;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${prompt}` }],
            },
          ],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.7,
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    const text = data.candidates?.[0]?.content?.parts
      ?.map((p: { text: string }) => p.text)
      .join('') || '';

    const promptTokens = data.usageMetadata?.promptTokenCount || 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
    const tokensUsed = promptTokens + outputTokens;
    const costs = this.MODEL_COSTS[model] || this.MODEL_COSTS['gemini-1.5-pro'];
    const cost = promptTokens * costs.input + outputTokens * costs.output;

    return {
      text,
      tokensUsed,
      cost,
      latencyMs,
      model,
    };
  }
}
