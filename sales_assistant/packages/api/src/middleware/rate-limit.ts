import { Redis } from 'ioredis';
import { structuredLogger } from '../observability/logger.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiterOptions {
  max?: number;
  windowMs?: number;
  redisUrl?: string;
  memoryOnly?: boolean;
}

interface MemoryEntry {
  count: number;
  windowStart: number;
}

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export class RateLimiter {
  readonly max: number;
  readonly windowMs: number;
  private readonly redis?: Redis;
  private readonly memory = new Map<string, MemoryEntry>();

  constructor(options: RateLimiterOptions = {}) {
    this.max = options.max ?? envInt('RATE_LIMIT_MAX', 100);
    this.windowMs = options.windowMs ?? envInt('RATE_LIMIT_WINDOW_MS', 60_000);
    if (!options.memoryOnly) {
      this.redis = new Redis(options.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379', {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      });
    }
  }

  async check(key: string): Promise<RateLimitResult> {
    if (!this.redis) return this.checkMemory(key);
    try {
      return await this.checkRedis(key, this.redis);
    } catch (err) {
      structuredLogger.warn('rate_limit.redis_unavailable', {
        error: err instanceof Error ? err.message : String(err),
        key,
      });
      return this.checkMemory(key);
    }
  }

  async close(): Promise<void> {
    if (!this.redis) return;
    const status = this.redis.status;
    if (status === 'end' || status === 'close') return;
    this.redis.disconnect();
  }

  private async checkRedis(key: string, redis: Redis): Promise<RateLimitResult> {
    if (redis.status === 'wait') await redis.connect();
    const windowStart = Math.floor(Date.now() / this.windowMs) * this.windowMs;
    const redisKey = `rate:${key}:${windowStart}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, Math.ceil(this.windowMs / 1000));
    }
    return this.result(count, windowStart);
  }

  private checkMemory(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    let entry = this.memory.get(key);
    if (!entry || entry.windowStart !== windowStart) {
      entry = { count: 0, windowStart };
      this.memory.set(key, entry);
    }
    entry.count += 1;
    return this.result(entry.count, windowStart);
  }

  private result(count: number, windowStart: number): RateLimitResult {
    const remaining = Math.max(0, this.max - count);
    const retryAfterMs = Math.max(1, windowStart + this.windowMs - Date.now());
    return { allowed: count <= this.max, remaining, retryAfterMs };
  }
}