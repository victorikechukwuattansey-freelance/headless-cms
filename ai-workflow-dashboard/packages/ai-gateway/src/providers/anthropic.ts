import type { ChatRequest, ChatResponse, ProviderAdapter, AiProviderName } from "../types";
import { AiGatewayError } from "../errors";

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string;
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly name: AiProviderName = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = "https://api.anthropic.com",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete(request: ChatRequest): Promise<ChatResponse> {
    if (!this.apiKey) {
      throw new AiGatewayError("PROVIDER_AUTH", "ANTHROPIC_API_KEY is not configured", this.name);
    }
    const startedAt = Date.now();
    const system = request.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const messages = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, "")}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: request.model,
          messages,
          ...(system ? { system } : {}),
          max_tokens: request.maxTokens ?? 2048,
          temperature: request.temperature ?? 0.7,
          top_p: request.topP ?? 1,
        }),
      });

      if (!res.ok) {
        throw new AiGatewayError(
          res.status === 401 || res.status === 403
            ? "PROVIDER_AUTH"
            : res.status === 429
              ? "PROVIDER_RATE_LIMITED"
              : "PROVIDER_UNAVAILABLE",
          `Anthropic request failed with status ${res.status}: ${await res.text()}`,
          this.name,
          res.status === 429 || res.status >= 500,
          res.status,
        );
      }

      const data = (await res.json()) as AnthropicResponse;
      const content = data.content?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("") ?? "";
      const inputTokens = data.usage?.input_tokens ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;

      return {
        content,
        model: request.model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs: Date.now() - startedAt,
        finishReason: data.stop_reason ?? "unknown",
        raw: data,
      };
    } catch (err) {
      if (err instanceof AiGatewayError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AiGatewayError("PROVIDER_TIMEOUT", "Anthropic request timed out after 120s", this.name, true);
      }
      throw new AiGatewayError("PROVIDER_UNAVAILABLE", `Anthropic request failed: ${(err as Error).message}`, this.name, true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
