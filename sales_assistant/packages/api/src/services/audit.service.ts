import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { DomainContext } from '../domain/domain-context.js';
import type { AuditEventType } from '../validation/schemas.js';

export async function writeAuditEvent(
  context: DomainContext,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await prisma.domainAuditEvent.create({
    data: {
      organizationId: context.organizationId,
      eventType,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

export class AuditService {
  async list(
    context: DomainContext,
    options: { limit: number; offset: number; type?: AuditEventType },
  ) {
    const where: Prisma.DomainAuditEventWhereInput = {
      organizationId: context.organizationId,
      ...(options.type ? { eventType: options.type } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.domainAuditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: options.offset,
        take: options.limit,
        select: { id: true, eventType: true, payload: true, createdAt: true },
      }),
      prisma.domainAuditEvent.count({ where }),
    ]);
    return { data, total };
  }
}
