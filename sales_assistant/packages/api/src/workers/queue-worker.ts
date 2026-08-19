import { QueueWorkerService } from './queue-worker.service.js';
import { RedisJobSource } from './redis-job-source.js';
import { createJobHandlers } from './handlers.js';
import { structuredLogger } from '../observability/logger.js';

const jobSource = new RedisJobSource();
const worker = new QueueWorkerService(createJobHandlers(), 1000, jobSource);

async function shutdown(signal: string): Promise<void> {
  structuredLogger.info('queue.worker.shutting_down', { signal });
  worker.stop();
  await jobSource.close().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

worker.start().catch((err: unknown) => {
  structuredLogger.error('queue.worker.stopped', { error: String(err) });
  process.exit(1);
});