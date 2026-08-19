import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { DomainContext } from '../domain/domain-context.js';

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