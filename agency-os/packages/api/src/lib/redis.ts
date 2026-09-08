import IORedis, { type RedisOptions } from 'ioredis';
import type { RedisReply } from 'rate-limit-redis';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __agencyOsRedis__: IORedis | undefined;
}

const toRedisOptions = (): RedisOptions => ({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: process.env.NODE_ENV === 'test',
});

const createRedis = () => {
  const client = new IORedis(toRedisOptions());

  client.on('error', (error) => {
    logger.error({ err: error }, 'Redis connection error');
  });

  client.on('connect', () => {
    logger.info({ event: 'redis_connected' }, 'Redis connected');
  });

  return client;
};

export const redis = globalThis.__agencyOsRedis__ ?? createRedis();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__agencyOsRedis__ = redis;
}

export const sendRedisCommand = (command: string, ...args: string[]) =>
  redis.call(command, ...args) as Promise<RedisReply>;
