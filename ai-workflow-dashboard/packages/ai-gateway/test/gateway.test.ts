import { describe, it, expect, vi } from "vitest";
import { AiGatewayService } from "../src/gateway";
import { OllamaAdapter } from "../src/providers/ollama";
import { AiGatewayError } from "../src/errors";
import { getModelProfile, estimateCostUsd } from "../src/router";

function stubFetch(response: unknown, status = 200): typeof fetch {
  return vi.fn(async () => {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(response),
      json: async () => response,
    } as Response;
  }) as unknown as typeof fetch;
}

describe("OllamaAdapter", () => {
  it("returns content and token counts", async () => {
    const fetchImpl = stubFetch({
      message: { content: "hello from ollama" },
      done: true,
      prompt_eval_count: 12,
      eval_count: 5,
    });
    const adapter = new OllamaAdapter("http://localhost:11434", fetchImpl);
    const res = await adapter.complete({
      model: "llama3.2",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.content).toBe("hello from ollama");
    expect(res.inputTokens).toBe(12);
    expect(res.outputTokens).toBe(5);
  });

  it("maps non-2xx to typed errors", async () => {
    const adapter = new OllamaAdapter("http://localhost:11434", stubFetch({}, 500));
    await expect(
      adapter.complete({ model: "x", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", retryable: true });
  });
});

describe("ModelRouter", () => {
  it("estimates cost from token counts", () => {
    const profile = getModelProfile("openai", "gpt-4o");
    const cost = estimateCostUsd(profile, 1_000_000, 0);
    expect(cost).toBeCloseTo(2.5);
  });
});

describe("AiGatewayService", () => {
  it("routes to default provider and falls back on failure", async () => {
    const failingFetch = stubFetch({}, 500);
    const okFetch = stubFetch({ message: { content: "ok" }, done: true });

    const gateway = new AiGatewayService({
      defaultProvider: "ollama",
      fallbackProvider: "openai",
      ollamaBaseUrl: "http://localhost:11434",
      ollamaModel: "llama3.2",
      openaiApiKey: "sk-test",
    });

    // Replace adapters with stubbed ones via casting (private map)
    const adapters = (gateway as unknown as { adapters: Map<string, unknown> }).adapters;
    adapters.set("ollama", new OllamaAdapter("http://localhost:11434", failingFetch));
    adapters.set("openai", {
      name: "openai",
      complete: async () => ({
        content: "ok",
        model: "gpt-4o-mini",
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        latencyMs: 100,
        finishReason: "stop",
      }),
    });

    const res = await gateway.complete({
      model: "llama3.2",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.content).toBe("ok");
    expect(res.usedFallback).toBe(true);
  });

  it("throws typed error when no fallback configured", async () => {
    const gateway = new AiGatewayService({
      defaultProvider: "ollama",
      fallbackProvider: "none",
      ollamaBaseUrl: "http://localhost:11434",
      ollamaModel: "llama3.2",
    });
    const adapters = (gateway as unknown as { adapters: Map<string, unknown> }).adapters;
    adapters.set("ollama", new OllamaAdapter("http://localhost:11434", stubFetch({}, 500)));
    await expect(
      gateway.complete({ model: "llama3.2", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toBeInstanceOf(AiGatewayError);
  });
});
