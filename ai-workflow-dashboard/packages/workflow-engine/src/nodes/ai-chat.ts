import type { NodeDefinition, NodeExecutionContext } from "../types";
import type { NodeExecutionResult } from "@awd/types";
import { EngineError } from "../errors";

export const aiChat: NodeDefinition = {
  type: "ai-chat",
  category: "AI",
  label: "AI Chat",
  description: "Calls an AI model through the platform AI Gateway.",
  icon: "sparkles",
  defaultConfig: {
    provider: "default",
    model: "llama3.2",
    systemPrompt: "You are a helpful assistant.",
    userPrompt: "{{trigger}}",
    temperature: 0.7,
    maxTokens: 2048,
  },
  configSchema: {
    provider: { type: "string", label: "Provider", description: "AI provider (default = platform default)" },
    model: { type: "string", required: true, label: "Model" },
    systemPrompt: { type: "string", label: "System prompt" },
    userPrompt: { type: "string", required: true, label: "User prompt" },
    temperature: { type: "number", label: "Temperature", default: 0.7 },
    maxTokens: { type: "number", label: "Max tokens", default: 2048 },
  },
  handler: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    if (!ctx.ai) {
      throw new EngineError("NO_ADAPTER_CONFIGURED", "AI execution is not configured for this worker");
    }
    const config = ctx.resolvedConfig;
    const provider = (config.provider as string | undefined) === "default" ? undefined : (config.provider as string | undefined);
    const systemPrompt = (config.systemPrompt as string | undefined) ?? "You are a helpful assistant.";
    const userPrompt = (config.userPrompt as string | undefined) ?? "";
    const temperature = typeof config.temperature === "number" ? config.temperature : 0.7;
    const maxTokens = typeof config.maxTokens === "number" ? config.maxTokens : 2048;

    ctx.log("info", "Invoking AI model", { provider: provider ?? "default", model: config.model });

    const completion = await ctx.ai.complete({
      provider,
      model: (config.model as string) ?? "llama3.2",
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens,
      correlationId: ctx.executionId,
    });

    return {
      status: "SUCCEEDED",
      output: {
        text: completion.content,
        provider: completion.provider,
        model: completion.model,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        costUsd: completion.costUsd,
      },
      aiUsage: {
        provider: completion.provider,
        model: completion.model,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        costUsd: completion.costUsd,
        latencyMs: completion.latencyMs,
      },
    };
  },
};
