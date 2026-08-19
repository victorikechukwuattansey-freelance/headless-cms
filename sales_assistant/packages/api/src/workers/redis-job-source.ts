import { Redis } from 'ioredis';
import type { JobSource, QueueJob } from './queue-worker.service.js';
import { recordQueueDepth } from '../observability/metrics.js';
import { structuredLogger } from '../observability/logger.js';

export const QUEUE_KEY = 'sales_assistant:jobs';

export interface RedisJobSourceOptions {
  url?: string;
  blockTimeoutSeconds?: number;
}

export class RedisJobSource implements JobSource {
  readonly redis: Redis;
  private readonly blockTimeoutSeconds: number;

  constructor(options: RedisJobSourceOptions = {}) {
    this.blockTimeoutSeconds = options.blockTimeoutSeconds ?? 1;
    this.redis = new Redis(options.url ?? process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
  }

  async connect(): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }
  }

  async enqueue(job: QueueJob): Promise<void> {
    if (this.redis.status === 'wait') await this.redis.connect();
    await this.redis.lpush(QUEUE_KEY, JSON.stringify(job));
  }

  async requeue(job: QueueJob, delayMs = 0): Promise<void> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await this.enqueue(job);
  }

  async receive(): Promise<QueueJob | null> {
    if (this.redis.status === 'wait') await this.redis.connect();
    const result = await this.redis.brpop(QUEUE_KEY, this.blockTimeoutSeconds);
    const depth = await this.redis.llen(QUEUE_KEY).catch(() => 0);
    recordQueueDepth(depth);
    if (!result) return null;
    const raw = result[1];
    try {
      return JSON.parse(raw) as QueueJob;
    } catch {
      structuredLogger.error('queue.source.invalid_payload', { raw });
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.redis.status === 'end' || this.redis.status === 'close') return;
    await this.redis.quit();
  }
}