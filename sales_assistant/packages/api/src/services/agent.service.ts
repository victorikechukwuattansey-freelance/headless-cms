import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import type { DomainContext } from '../domain/domain-context.js';
import { DomainError } from '../domain/domain-error.js';
import { writeAuditEvent } from './audit.service.js';

const ACTIVE_LEAD_STATUSES = ['new', 'assigned', 'contacted', 'qualified'];

export interface AgentListOptions {
  limit: number;
  offset: number;
  available?: boolean;
}

export class AgentService {
  async list(context: DomainContext, options: AgentListOptions) {
    const where: Prisma.AgentWhereInput = {
      organizationId: context.organizationId,
      ...(options.available !== undefined ? { status: options.available ? 'idle' : 'busy' } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: options.offset,
        take: options.limit,
      }),
      prisma.agent.count({ where }),
    ]);
    return { data, total };
  }

  async getScoped(context: DomainContext, agentId: string) {
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, organizationId: context.organizationId },
    });
    if (!agent) throw new DomainError('NOT_FOUND', 'Agent not found');
    return agent;
  }

  async setAvailability(context: DomainContext, agentId: string, available: boolean) {
    const agent = await this.getScoped(context, agentId);
    const updated = await prisma.agent.update({
      where: { id: agent.id },
      data: { status: available ? 'idle' : 'busy' },
    });
    await writeAuditEvent(context, 'AGENT_AVAILABILITY_CHANGED', {
      agentId: agent.id,
      available,
    });
    return updated;
  }

  async selectLeastLoaded(context: DomainContext) {
    const agents = await prisma.agent.findMany({
      where: { organizationId: context.organizationId, status: 'idle' },
      orderBy: { createdAt: 'asc' },
    });
    if (agents.length === 0) {
      throw new DomainError('NO_AGENT_AVAILABLE', 'No agent is currently available');
    }

    const activeAssignments = await prisma.leadProfile.findMany({
      where: {
        organizationId: context.organizationId,
        status: { in: ACTIVE_LEAD_STATUSES },
        agentId: { not: null },
      },
      select: { agentId: true },
    });

    const loadByAgent = new Map<string, number>();
    for (const row of activeAssignments) {
      if (row.agentId) loadByAgent.set(row.agentId, (loadByAgent.get(row.agentId) ?? 0) + 1);
    }
    return [...agents].sort(
      (a, b) => (loadByAgent.get(a.id) ?? 0) - (loadByAgent.get(b.id) ?? 0),
    )[0];
  }

  async releaseIfIdle(context: DomainContext, agentId: string): Promise<void> {
    const active = await prisma.leadProfile.count({
      where: {
        organizationId: context.organizationId,
        agentId,
        status: { in: ACTIVE_LEAD_STATUSES },
      },
    });
    if (active === 0) {
      await prisma.agent.update({ where: { id: agentId }, data: { status: 'idle' } });
    }
  }
}