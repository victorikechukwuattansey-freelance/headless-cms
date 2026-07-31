import type { AiProviderName, ChatRequest, ChatResponse, ProviderAdapter } from "./types";
import { AiGatewayError, isRetryableError } from "./errors";
import { estimateCostUsd, getModelProfile, resolveFallback } from "./router";
import { OllamaAdapter } from "./providers/ollama";
import { OpenAiAdapter } from "./providers/openai";
import { AnthropicAdapter } from "./providers/anthropic";
import { GeminiAdapter } from "./providers/gemini";
import type { Logger } from "@awd/logger";

export interface AiGatewayConfig {
  defaultProvider: AiProviderName;
  fallbackProvider: AiProviderName | "none";
  ollamaBaseUrl: string;
  ollamaModel: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  maxRetries?: number;
  logger?: Logger;
}

export interface AiCompletion {
  content: string;
  provider: AiProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  finishReason: string;
  usedFallback: boolean;
}

export interface TokenUsage {
  provider: AiProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
}

export class AiGatewayService {
  private readonly adapters: Map<AiProviderName, ProviderAdapter>;
  private readonly config: AiGatewayConfig;
  private readonly logger?: Logger;

  constructor(config: AiGatewayConfig) {
    this.config = config;
    this.logger = config.logger;
    this.adapters = new Map();
    this.adapters.set("ollama", new OllamaAdapter(config.ollamaBaseUrl));
    this.adapters.set("openai", new OpenAiAdapter(config.openaiApiKey ?? "", config.openaiBaseUrl));
    this.adapters.set("anthropic", new AnthropicAdapter(config.anthropicApiKey ?? ""));
    this.adapters.set("gemini", new GeminiAdapter(config.geminiApiKey ?? ""));
  }

  listProviders(): AiProviderName[] {
    return [...this.adapters.keys()];
  }

  async complete(
    request: ChatRequest,
    options: { provider?: AiProviderName; correlationId?: string } = {},
  ): Promise<AiCompletion> {
    const requested = options.provider ?? this.config.defaultProvider;
    const maxRetries = this.config.maxRetries ?? 1;
    let usedFallback = false;

    try {
      const response = await this.attempt(request, requested, options.correlationId, maxRetries);
      return this.toCompletion(response, requested, usedFallback);
    } catch (err) {
      if (isRetryableError(err) && this.config.fallbackProvider !== "none") {
        const fallback = resolveFallback(requested, this.config.fallbackProvider);
        this.logger?.warn(`AI provider ${requested} failed, falling back to ${fallback}`, {
          correlationId: options.correlationId,
          error: (err as Error).message,
        });
        usedFallback = true;
        const response = await this.attempt(request, fallback, options.correlationId, maxRetries);
        return this.toCompletion(response, fallback, usedFallback);
      }
      throw err;
    }
  }

  private async attempt(
    request: ChatRequest,
    provider: AiProviderName,
    correlationId: string | undefined,
    maxRetries: number,
  ): Promise<ChatResponse> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new AiGatewayError("NO_ADAPTER_CONFIGURED", `No adapter registered for provider '${provider}'`, provider);
    }
    let attempt = 0;
    for (;;) {
      try {
        return await adapter.complete(request);
      } catch (err) {
        const retryable = isRetryableError(err);
        if (!retryable || attempt >= maxRetries) {
          throw err;
        }
        attempt += 1;
        const delayMs = Math.min(1_000 * 2 ** attempt, 10_000);
        this.logger?.warn(`Retrying AI request (${attempt}/${maxRetries}) in ${delayMs}ms`, {
          provider,
          model: request.model,
          correlationId,
          error: (err as Error).message,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private toCompletion(response: ChatResponse, provider: AiProviderName, usedFallback: boolean): AiCompletion {
    const profile = getModelProfile(provider, response.model);
    const costUsd = estimateCostUsd(profile, response.inputTokens, response.outputTokens);
    return {
      content: response.content,
      provider,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      totalTokens: response.totalTokens,
      costUsd,
      latencyMs: response.latencyMs,
      finishReason: response.finishReason,
      usedFallback,
    };
  }
}
