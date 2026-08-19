import { prisma } from '../lib/prisma.js';
import type { DomainContext } from '../domain/domain-context.js';
import { writeAuditEvent } from './audit.service.js';

export interface ReminderListOptions {
  limit: number;
  offset: number;
  status?: string;
}

const ACTIVE_LEAD_STATUSES = ['new', 'assigned', 'contacted', 'qualified'];

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export class FollowUpReminderService {
  async generateReminders(context: DomainContext) {
    const thresholdDays = envInt('FOLLOW_UP_THRESHOLD_DAYS', 7);
    const dueHours = envInt('FOLLOW_UP_DUE_HOURS', 24);
    const cutoff = new Date(Date.now() - thresholdDays * 86_400_000);

    const qualifying = await prisma.leadProfile.findMany({
      where: {
        organizationId: context.organizationId,
        status: { in: ACTIVE_LEAD_STATUSES },
        OR: [
          { lastContactedAt: null, createdAt: { lt: cutoff } },
          { lastContactedAt: { lt: cutoff } },
        ],
      },
    });
    if (qualifying.length === 0) {
      await writeAuditEvent(context, 'BULK_REMINDERS_GENERATED', { generated: 0, total: 0 });
      return { generated: 0, total: 0 };
    }

    const leadIds = qualifying.map((lead) => lead.id);
    const existing = await prisma.followUpReminder.findMany({
      where: { organizationId: context.organizationId, status: 'pending', leadId: { in: leadIds } },
      select: { leadId: true },
    });
    const existingSet = new Set(existing.map((reminder) => reminder.leadId));

    const dueAt = new Date(Date.now() + dueHours * 3_600_000);
    const toCreate = qualifying.filter((lead) => !existingSet.has(lead.id));
    if (toCreate.length > 0) {
      await prisma.followUpReminder.createMany({
        data: toCreate.map((lead) => ({
          organizationId: context.organizationId,
          leadId: lead.id,
          agentId: lead.agentId,
          dueAt,
          message: `Follow up with ${lead.name ?? `lead ${lead.phone}`} (score ${lead.score}${lead.scoreReason ? `, ${lead.scoreReason}` : ''})`,
        })),
      });
    }

    await writeAuditEvent(context, 'BULK_REMINDERS_GENERATED', { generated: toCreate.length, total: qualifying.length });
    return { generated: toCreate.length, total: qualifying.length };
  }

  async list(context: DomainContext, options: ReminderListOptions) {
    const where = {
      organizationId: context.organizationId,
      ...(options.status ? { status: options.status } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.followUpReminder.findMany({
        where,
        include: { lead: { select: { phone: true, name: true } } },
        orderBy: { dueAt: 'asc' },
        skip: options.offset,
        take: options.limit,
      }),
      prisma.followUpReminder.count({ where }),
    ]);
    return { data, total };
  }
}