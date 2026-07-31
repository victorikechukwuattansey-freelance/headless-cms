import type { ChatRequest, ChatResponse, ProviderAdapter, AiProviderName } from "../types";
import { AiGatewayError } from "../errors";

interface OllamaChatResponse {
  message?: { content?: string };
  done?: boolean;
  total_duration?: number;
  eval_count?: number;
  prompt_eval_count?: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class OllamaAdapter implements ProviderAdapter {
  readonly name: AiProviderName = "ollama";

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete(request: ChatRequest): Promise<ChatResponse> {
    const startedAt = Date.now();
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/chat`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: false,
          options: {
            temperature: request.temperature ?? 0.7,
            top_p: request.topP ?? 1,
            num_predict: request.maxTokens ?? 2048,
          },
        }),
      });

      if (!res.ok) {
        throw new AiGatewayError(
          res.status === 404 ? "MODEL_NOT_FOUND" : res.status === 401 ? "PROVIDER_AUTH" : "PROVIDER_UNAVAILABLE",
          `Ollama request failed with status ${res.status}`,
          this.name,
          res.status >= 500,
          res.status,
        );
      }

      const data = (await res.json()) as OllamaChatResponse;
      const content = data.message?.content ?? "";
      const inputTokens = data.prompt_eval_count ?? estimateTokens(request.messages.reduce((acc, m) => acc + m.content, ""));
      const outputTokens = data.eval_count ?? estimateTokens(content);

      return {
        content,
        model: request.model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs: Date.now() - startedAt,
        finishReason: data.done ? "stop" : "unknown",
        raw: data,
      };
    } catch (err) {
      if (err instanceof AiGatewayError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AiGatewayError("PROVIDER_TIMEOUT", "Ollama request timed out after 120s", this.name, true);
      }
      throw new AiGatewayError("PROVIDER_UNAVAILABLE", `Ollama request failed: ${(err as Error).message}`, this.name, true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
