import type { ModelProfile, AiProviderName } from "./types";
import { AiGatewayError } from "./errors";

export const MODEL_PROFILES: Record<string, ModelProfile> = {
  "ollama/llama3.2": {
    provider: "ollama",
    model: "llama3.2",
    maxContext: 131_072,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    toolCalling: true,
    streaming: true,
  },
  "ollama/llama3.1": {
    provider: "ollama",
    model: "llama3.1",
    maxContext: 131_072,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    toolCalling: true,
    streaming: true,
  },
  "openai/gpt-4o": {
    provider: "openai",
    model: "gpt-4o",
    maxContext: 128_000,
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10,
    toolCalling: true,
    streaming: true,
  },
  "openai/gpt-4o-mini": {
    provider: "openai",
    model: "gpt-4o-mini",
    maxContext: 128_000,
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    toolCalling: true,
    streaming: true,
  },
  "anthropic/claude-sonnet-4-5": {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    maxContext: 200_000,
    inputCostPerMillion: 3,
    outputCostPerMillion: 15,
    toolCalling: true,
    streaming: true,
  },
  "gemini/gemini-2.0-flash": {
    provider: "gemini",
    model: "gemini-2.0-flash",
    maxContext: 1_048_576,
    inputCostPerMillion: 0.1,
    outputCostPerMillion: 0.4,
    toolCalling: true,
    streaming: true,
  },
};

export function getModelProfile(provider: AiProviderName, model: string): ModelProfile {
  const profile = MODEL_PROFILES[`${provider}/${model}`];
  if (profile) return profile;
  return {
    provider,
    model,
    maxContext: 128_000,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    toolCalling: true,
    streaming: true,
  };
}

export function estimateCostUsd(
  profile: ModelProfile,
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens / 1_000_000) * profile.inputCostPerMillion +
    (outputTokens / 1_000_000) * profile.outputCostPerMillion
  );
}

export function resolveFallback(
  requested: AiProviderName,
  fallback: AiProviderName | "none",
): AiProviderName {
  if (fallback === "none" || fallback === requested) {
    throw new AiGatewayError("NO_ADAPTER_CONFIGURED", `No AI provider configured and fallback is disabled`);
  }
  return fallback;
}
