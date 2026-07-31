import type { AiExecutor } from "@awd/workflow-engine";
import { AiGatewayService } from "@awd/ai-gateway";
import type { AiProviderName, ChatMessage } from "@awd/ai-gateway";
import { loadEnv } from "@awd/config";
import { prisma } from "@awd/database";

/**
 * Adapts the AI Gateway service to the engine's AiExecutor contract.
 */
export function createAiExecutor(gateway: AiGatewayService): AiExecutor {
  return {
    async complete({ provider, model, systemPrompt, userPrompt, temperature, maxTokens, correlationId }) {
      const messages: ChatMessage[] = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: userPrompt });

      const completion = await gateway.complete(
        {
          model,
          messages,
          temperature,
          maxTokens,
        },
        { provider: provider as AiProviderName | undefined, correlationId },
      );

      if (correlationId) {
        try {
          const execution = await prisma.execution.findUnique({
            where: { id: correlationId },
            select: { organizationId: true, workflowId: true },
          });
          if (execution) {
            await prisma.usageRecord.create({
              data: {
                organizationId: execution.organizationId,
                executionId: correlationId,
                kind: "ai_chat",
                provider: completion.provider ?? null,
                model: completion.model ?? null,
                quantity: (completion.inputTokens ?? 0) + (completion.outputTokens ?? 0),
                unit: "tokens",
                costUsd: completion.costUsd ?? 0,
                metadata: {
                  workflowId: execution.workflowId,
                  inputTokens: completion.inputTokens,
                  outputTokens: completion.outputTokens,
                  latencyMs: completion.latencyMs,
                },
              },
            });
          }
        } catch (err) {
          // Usage recording must never fail the AI call itself.
          // eslint-disable-next-line no-console
          console.error("Failed to record AI usage", err);
        }
      }

      return {
        content: completion.content,
        provider: completion.provider,
        model: completion.model,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        costUsd: completion.costUsd,
        latencyMs: completion.latencyMs,
      };
    },
  };
}

export function createGateway(): AiGatewayService {
  const env = loadEnv();
  return new AiGatewayService({
    defaultProvider: env.AI_DEFAULT_PROVIDER,
    fallbackProvider: env.AI_FALLBACK_PROVIDER,
    ollamaBaseUrl: env.OLLAMA_BASE_URL,
    ollamaModel: env.OLLAMA_MODEL,
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
  });
}
