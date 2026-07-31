import type { ChatRequest, ChatResponse, ProviderAdapter, AiProviderName } from "../types";
import { AiGatewayError } from "../errors";

interface OpenAiChatResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAiAdapter implements ProviderAdapter {
  readonly name: AiProviderName = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = "https://api.openai.com/v1",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete(request: ChatRequest): Promise<ChatResponse> {
    if (!this.apiKey) {
      throw new AiGatewayError("PROVIDER_AUTH", "OPENAI_API_KEY is not configured", this.name);
    }
    const startedAt = Date.now();
    const url = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          top_p: request.topP ?? 1,
          max_tokens: request.maxTokens ?? 2048,
        }),
      });

      if (!res.ok) {
        throw new AiGatewayError(
          res.status === 401 || res.status === 403
            ? "PROVIDER_AUTH"
            : res.status === 429
              ? "PROVIDER_RATE_LIMITED"
              : res.status === 404
                ? "MODEL_NOT_FOUND"
                : "PROVIDER_UNAVAILABLE",
          `OpenAI request failed with status ${res.status}: ${await res.text()}`,
          this.name,
          res.status === 429 || res.status >= 500,
          res.status,
        );
      }

      const data = (await res.json()) as OpenAiChatResponse;
      const content = data.choices?.[0]?.message?.content ?? "";
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;

      return {
        content,
        model: request.model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs: Date.now() - startedAt,
        finishReason: data.choices?.[0]?.finish_reason ?? "unknown",
        raw: data,
      };
    } catch (err) {
      if (err instanceof AiGatewayError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AiGatewayError("PROVIDER_TIMEOUT", "OpenAI request timed out after 120s", this.name, true);
      }
      throw new AiGatewayError("PROVIDER_UNAVAILABLE", `OpenAI request failed: ${(err as Error).message}`, this.name, true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
