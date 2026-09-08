import type { JobHandler, QueueJob } from './queue-worker.service.js';
import type { DomainContext } from '../domain/domain-context.js';
import { z } from 'zod';
import { LeadScoreService } from '../services/lead-score.service.js';
import { FollowUpReminderService } from '../services/follow-up-reminder.service.js';

export interface JobContextPayload {
  organizationId: string;
  userId: string;
  role: 'USER' | 'AGENT' | 'ADMIN';
  leadId?: string;
}

const jobContextSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(['USER', 'AGENT', 'ADMIN']),
  leadId: z.string().min(1).optional(),
});

function parseJobPayload(job: QueueJob): JobContextPayload {
  const result = jobContextSchema.safeParse(job.payload);
  if (!result.success) {
    throw new Error(`job "${job.type}" has an invalid payload`);
  }
  return result.data;
}

function toContext(payload: JobContextPayload): DomainContext {
  return { userId: payload.userId, organizationId: payload.organizationId, role: payload.role };
}

export function createJobHandlers(): Map<string, JobHandler> {
  return new Map<string, JobHandler>([
    [
      'score-lead',
      async (job: QueueJob) => {
        const payload = parseJobPayload(job);
        if (!payload.leadId) throw new Error('score-lead job requires leadId');
        await new LeadScoreService().scoreLead(toContext(payload), payload.leadId);
      },
    ],
    [
      'generate-follow-up-reminders',
      async (job: QueueJob) => {
        const payload = parseJobPayload(job);
        await new FollowUpReminderService().generateReminders(toContext(payload));
      },
    ],
  ]);
}