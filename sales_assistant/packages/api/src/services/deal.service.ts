import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import type { DomainContext } from '../domain/domain-context.js';
import { DomainError } from '../domain/domain-error.js';
import { assertTransition, DEAL_TRANSITIONS, type DealStage } from '../domain/transitions.js';
import { writeAuditEvent } from './audit.service.js';

export interface CreateDealInput {
  amount: number;
  stage?: DealStage;
}

export interface DealListOptions {
  limit: number;
  offset: number;
  stage?: DealStage;
}

export class DealService {
  async list(context: DomainContext, options: DealListOptions) {
    const where: Prisma.DealWhereInput = {
      organizationId: context.organizationId,
      ...(options.stage ? { stage: options.stage } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: options.offset,
        take: options.limit,
      }),
      prisma.deal.count({ where }),
    ]);
    return { data, total };
  }

  async get(context: DomainContext, dealId: string) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, organizationId: context.organizationId },
    });
    if (!deal) throw new DomainError('NOT_FOUND', 'Deal not found');
    return deal;
  }

  async create(context: DomainContext, input: CreateDealInput) {
    if (!Number.isFinite(input.amount) || input.amount < 0) {
      throw new DomainError('VALIDATION', 'Deal amount must be a non-negative number');
    }
    const deal = await prisma.deal.create({
      data: {
        organizationId: context.organizationId,
        amount: input.amount,
        stage: input.stage ?? 'proposed',
      },
    });
    await writeAuditEvent(context, 'DEAL_CREATED', { dealId: deal.id, amount: input.amount });
    return deal;
  }

  async transitionStage(context: DomainContext, dealId: string, to: DealStage) {
    const deal = await this.get(context, dealId);
    assertTransition(DEAL_TRANSITIONS, deal.stage as DealStage, to, 'deal stage');
    const updated = await prisma.deal.update({
      where: { id: deal.id },
      data: { stage: to },
    });
    await writeAuditEvent(context, 'DEAL_STAGE_CHANGED', {
      dealId: deal.id,
      from: deal.stage,
      to,
    });
    return updated;
  }
}