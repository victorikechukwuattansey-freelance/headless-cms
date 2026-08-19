import { prisma } from '../lib/prisma.js';
import { createAiProvider, type AiProvider, type ChatMessage } from '../ai/provider.js';
import { recordAiUsage } from '../observability/metrics.js';
import type { DomainContext } from '../domain/domain-context.js';
import { writeAuditEvent } from './audit.service.js';

const COST_PER_1K_TOKENS: Record<string, number> = {
  'gpt-4o-mini': 0.00015,
  'gpt-4o': 0.0025,
};

export interface CompleteInput {
  model: string;
  messages: ChatMessage[];
}

export class AiUsageService {
  constructor(private readonly provider?: AiProvider) {}

  async complete(context: DomainContext, input: CompleteInput) {
    const provider = this.provider ?? createAiProvider();
    const result = await provider.complete({ model: input.model, messages: input.messages });
    const tokensIn = result.tokensIn;
    const tokensOut = result.tokensOut;
    const cost = (COST_PER_1K_TOKENS[input.model] ?? 0) * ((tokensIn + tokensOut) / 1000);

    recordAiUsage(context.organizationId, input.model, tokensIn, tokensOut);
    await prisma.aiUsageLog.create({
      data: {
        organizationId: context.organizationId,
        model: input.model,
        tokensIn,
        tokensOut,
        cost,
      },
    });
    await writeAuditEvent(context, 'AI_USAGE_LOGGED', {
      model: input.model,
      tokensIn,
      tokensOut,
    });
    return { content: result.content, tokensIn, tokensOut, cost };
  }
}