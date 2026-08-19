import type { JobHandler, QueueJob } from './queue-worker.service.js';
import type { DomainContext } from '../domain/domain-context.js';
import { LeadScoreService } from '../services/lead-score.service.js';
import { FollowUpReminderService } from '../services/follow-up-reminder.service.js';

export interface JobContextPayload {
  organizationId: string;
  userId: string;
  role: 'USER' | 'AGENT' | 'ADMIN';
  leadId?: string;
}

function toContext(payload: JobContextPayload): DomainContext {
  return { userId: payload.userId ?? 'queue-worker', organizationId: payload.organizationId, role: payload.role ?? 'ADMIN' };
}

export function createJobHandlers(): Map<string, JobHandler> {
  return new Map<string, JobHandler>([
    [
      'score-lead',
      async (job: QueueJob) => {
        const payload = job.payload as JobContextPayload;
        if (!payload?.leadId) throw new Error('score-lead job requires leadId');
        await new LeadScoreService().scoreLead(toContext(payload), payload.leadId);
      },
    ],
    [
      'generate-follow-up-reminders',
      async (job: QueueJob) => {
        const payload = job.payload as JobContextPayload;
        await new FollowUpReminderService().generateReminders(toContext(payload));
      },
    ],
  ]);
}