import { recordQueueJob as recordQueueJobMetric, recordQueueJobDuration } from '../observability/metrics.js';
import { structuredLogger } from '../observability/logger.js';

export interface QueueJob {
  id: string;
  type: string;
  payload?: unknown;
  attempts?: number;
}

export type JobHandler = (job: QueueJob) => Promise<void>;

export interface JobSource {
  receive(): Promise<QueueJob | null>;
  requeue?(job: QueueJob, delayMs?: number): Promise<void>;
}

export class QueueWorkerService {
  private polling = false;

  constructor(
    private readonly handlers: Map<string, JobHandler>,
    private readonly pollIntervalMs = 1000,
    private readonly source?: JobSource,
    private readonly maxAttempts = 3,
    private readonly retryDelayMs = 1000,
  ) {}

  recordQueueJob(job: QueueJob, succeeded: boolean): void {
    structuredLogger.info('queue.job.done', { jobId: job.id, type: job.type, succeeded });
    recordQueueJobMetric(job.type, succeeded);
  }

  async processJob(job: QueueJob): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) throw new Error(`No handler registered for job type ${job.type}`);
    const started = Date.now();
    try {
      await handler(job);
      recordQueueJobDuration(job.type, Date.now() - started);
      this.recordQueueJob(job, true);
    } catch (err) {
      this.recordQueueJob(job, false);
      const attempts = (job.attempts ?? 0) + 1;
      if (attempts <= this.maxAttempts && this.source?.requeue) {
        const delay = this.retryDelayMs * 2 ** (attempts - 1);
        structuredLogger.warn('queue.job.retry', {
          jobId: job.id,
          type: job.type,
          attempts,
          delayMs: delay,
          error: err instanceof Error ? err.message : String(err),
        });
        await this.source.requeue({ ...job, attempts }, delay);
        return;
      }
      throw err;
    }
  }

  async start(): Promise<void> {
    if (!this.source) throw new Error('No job source configured');
    this.polling = true;
    while (this.polling) {
      this.recordQueuePoll();
      const job = await this.source.receive();
      if (job) {
        try {
          await this.processJob(job);
        } catch (err) {
          structuredLogger.error('queue.job.failed', {
            jobId: job.id,
            type: job.type,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      }
    }
  }

  stop(): void {
    this.polling = false;
  }

  private recordQueuePoll(): void {
    structuredLogger.debug('queue.poll');
  }
}