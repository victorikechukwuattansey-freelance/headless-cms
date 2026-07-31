import type { ChatRequest, ChatResponse, ProviderAdapter, AiProviderName } from "../types";
import { AiGatewayError } from "../errors";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export class GeminiAdapter implements ProviderAdapter {
  readonly name: AiProviderName = "gemini";

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = "https://generativelanguage.googleapis.com/v1beta",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete(request: ChatRequest): Promise<ChatResponse> {
    if (!this.apiKey) {
      throw new AiGatewayError("PROVIDER_AUTH", "GEMINI_API_KEY is not configured", this.name);
    }
    const startedAt = Date.now();
    const systemInstruction = request.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const contents = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const url = `${this.baseUrl.replace(/\/$/, "")}/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents,
          ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
          generationConfig: {
            temperature: request.temperature ?? 0.7,
            topP: request.topP ?? 1,
            maxOutputTokens: request.maxTokens ?? 2048,
          },
        }),
      });

      if (!res.ok) {
        throw new AiGatewayError(
          res.status === 400 || res.status === 403
            ? "PROVIDER_AUTH"
            : res.status === 429
              ? "PROVIDER_RATE_LIMITED"
              : "PROVIDER_UNAVAILABLE",
          `Gemini request failed with status ${res.status}: ${await res.text()}`,
          this.name,
          res.status === 429 || res.status >= 500,
          res.status,
        );
      }

      const data = (await res.json()) as GeminiResponse;
      const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

      return {
        content,
        model: request.model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs: Date.now() - startedAt,
        finishReason: data.candidates?.[0]?.finishReason ?? "unknown",
        raw: data,
      };
    } catch (err) {
      if (err instanceof AiGatewayError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AiGatewayError("PROVIDER_TIMEOUT", "Gemini request timed out after 120s", this.name, true);
      }
      throw new AiGatewayError("PROVIDER_UNAVAILABLE", `Gemini request failed: ${(err as Error).message}`, this.name, true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
