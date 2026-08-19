import { prisma } from '../lib/prisma.js';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { DomainContext } from '../domain/domain-context.js';
import { DomainError } from '../domain/domain-error.js';
import { assertTransition, LEAD_TRANSITIONS, type LeadStatus } from '../domain/transitions.js';
import { AgentService } from './agent.service.js';
import { writeAuditEvent } from './audit.service.js';
import { enqueueJob } from '../workers/job-queue.js';

const RECENT_SCORE_MS = 24 * 60 * 60 * 1000;

export interface CreateLeadInput {
  phone: string;
  name?: string;
  score?: number;
}

export interface UpdateLeadInput {
  phone?: string;
  name?: string;
  score?: number;
}

export interface LeadListOptions {
  limit: number;
  offset: number;
  status?: LeadStatus;
  agentId?: string;
}

export class LeadProfileService {
  private readonly agents = new AgentService();

  async list(context: DomainContext, options: LeadListOptions) {
    const where: Prisma.LeadProfileWhereInput = {
      organizationId: context.organizationId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.agentId ? { agentId: options.agentId } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.leadProfile.findMany({
        where,
        include: { agent: true },
        orderBy: { createdAt: 'desc' },
        skip: options.offset,
        take: options.limit,
      }),
      prisma.leadProfile.count({ where }),
    ]);
    return { data, total };
  }

  async get(context: DomainContext, leadId: string) {
    const lead = await prisma.leadProfile.findFirst({
      where: { id: leadId, organizationId: context.organizationId },
      include: { agent: true },
    });
    if (!lead) throw new DomainError('NOT_FOUND', 'Lead not found');
    return lead;
  }

  async create(context: DomainContext, input: CreateLeadInput) {
    const phone = input.phone.trim();
    if (!phone) throw new DomainError('VALIDATION', 'Lead phone is required');
    const lead = await prisma.leadProfile.create({
      data: {
        organizationId: context.organizationId,
        phone,
        name: input.name?.trim() || null,
        score: input.score ?? 0,
        lastContactedAt: new Date(),
      },
    });
    await writeAuditEvent(context, 'LEAD_CREATED', { leadId: lead.id, phone });
    await this.enqueueScoring(context, lead.id, lead.lastScoredAt);
    return lead;
  }

  async update(context: DomainContext, leadId: string, input: UpdateLeadInput) {
    const lead = await this.get(context, leadId);
    const updated = await prisma.leadProfile.update({
      where: { id: lead.id },
      data: {
        phone: input.phone?.trim() || lead.phone,
        name: input.name !== undefined ? (input.name.trim() || null) : lead.name,
        score: input.score ?? lead.score,
      },
    });
    await writeAuditEvent(context, 'LEAD_UPDATED', { leadId: lead.id });
    await this.enqueueScoring(context, lead.id, lead.lastScoredAt);
    return updated;
  }

  async transitionStatus(context: DomainContext, leadId: string, to: LeadStatus) {
    const lead = await this.get(context, leadId);
    assertTransition(LEAD_TRANSITIONS, lead.status as LeadStatus, to, 'lead status');
    const updated = await prisma.leadProfile.update({
      where: { id: lead.id },
      data: {
        status: to,
        ...(to === 'contacted' ? { lastContactedAt: new Date() } : {}),
      },
    });
    await writeAuditEvent(context, 'LEAD_STATUS_CHANGED', {
      leadId: lead.id,
      from: lead.status,
      to,
    });
    if (lead.agentId) {
      await this.agents.releaseIfIdle(context, lead.agentId);
    }
    return updated;
  }

  async assign(context: DomainContext, leadId: string, agentId?: string) {
    const lead = await this.get(context, leadId);
    if (lead.status !== 'new' && lead.status !== 'assigned') {
      throw new DomainError('INVALID_TRANSITION', `Cannot assign a lead in status ${lead.status}`);
    }
    const agent = agentId ? await this.agents.getScoped(context, agentId) : await this.agents.selectLeastLoaded(context);
    const updated = await prisma.leadProfile.update({
      where: { id: lead.id },
      data: { agentId: agent.id, status: 'assigned' },
    });
    await prisma.agent.update({ where: { id: agent.id }, data: { status: 'busy' } });
    await writeAuditEvent(context, 'LEAD_ASSIGNED', { leadId: lead.id, agentId: agent.id });
    return updated;
  }

  private async enqueueScoring(context: DomainContext, leadId: string, lastScoredAt: Date | null): Promise<void> {
    if (lastScoredAt && Date.now() - lastScoredAt.getTime() < RECENT_SCORE_MS) return;
    await enqueueJob({
      id: `score-${leadId}-${randomUUID()}`,
      type: 'score-lead',
      payload: { leadId, organizationId: context.organizationId, userId: context.userId, role: context.role },
    });
  }
}