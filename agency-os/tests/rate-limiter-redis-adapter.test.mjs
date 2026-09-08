import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const redisLibPath = path.join(repoRoot, 'packages/api/src/lib/redis.ts');
const rateLimiterPath = path.join(repoRoot, 'packages/api/src/middleware/rateLimiter.ts');

const redisLib = fs.readFileSync(redisLibPath, 'utf8');
const rateLimiter = fs.readFileSync(rateLimiterPath, 'utf8');

assert.equal(
  redisLib.includes('export const sendRedisCommand ='),
  true,
  'packages/api/src/lib/redis.ts should export a dedicated sendRedisCommand helper',
);

assert.equal(
  redisLib.includes("import type { RedisReply } from 'rate-limit-redis';"),
  true,
  'packages/api/src/lib/redis.ts should import RedisReply for the adapter return type',
);

assert.equal(
  redisLib.includes('as Promise<RedisReply>'),
  true,
  'packages/api/src/lib/redis.ts should cast redis.call(...) to Promise<RedisReply>',
);

assert.equal(
  rateLimiter.includes('sendCommand: sendRedisCommand'),
  true,
  'packages/api/src/middleware/rateLimiter.ts should pass sendRedisCommand directly to RedisStore',
);

assert.equal(
  rateLimiter.includes('new RedisStore(redisStoreConnection)'),
  false,
  'packages/api/src/middleware/rateLimiter.ts should not wrap RedisStore with redisStoreConnection',
);
