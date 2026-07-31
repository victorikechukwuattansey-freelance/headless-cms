import { Injectable, Logger } from '@nestjs/common';
import { AIProviderResponse } from './openai.provider';

@Injectable()
export class OllamaProvider {
  private readonly logger = new Logger(OllamaProvider.name);

  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  async generate(
    prompt: string,
    systemPrompt: string,
    model: string = 'llama3.2',
    maxTokens: number = 2048,
  ): Promise<AIProviderResponse> {
    const startTime = Date.now();

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `${systemPrompt}\n\n${prompt}`,
        stream: false,
        options: {
          num_predict: maxTokens,
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    const tokensUsed = (data.prompt_eval_count || 0) + (data.eval_count || 0);

    return {
      text: data.response || '',
      tokensUsed,
      cost: 0,
      latencyMs,
      model: data.model || model,
    };
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    const data = await response.json();
    return data.models?.map((m: { name: string }) => m.name) || [];
  }
}
