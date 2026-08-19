import { RedisJobSource } from './redis-job-source.js';
import type { QueueJob } from './queue-worker.service.js';
import { structuredLogger } from '../observability/logger.js';

let jobSource: RedisJobSource | null = null;

export async function enqueueJob(job: QueueJob): Promise<void> {
  try {
    jobSource ??= new RedisJobSource();
    await jobSource.enqueue(job);
  } catch (err) {
    structuredLogger.warn('queue.enqueue_failed', {
      jobType: job.type,
      jobId: job.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function closeJobQueue(): Promise<void> {
  if (jobSource) {
    await jobSource.close().catch(() => undefined);
    jobSource = null;
  }
}