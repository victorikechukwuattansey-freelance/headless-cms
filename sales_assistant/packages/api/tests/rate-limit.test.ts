import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/middleware/rate-limit.js';
import type { Redis } from 'ioredis';

test('memory limiter allows up to max requests per window then blocks', async () => {
  const limiter = new RateLimiter({ max: 3, windowMs: 60_000, memoryOnly: true });

  const first = await limiter.check('user:1');
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 2);
  assert.ok(first.retryAfterMs >= 1);

  const second = await limiter.check('user:1');
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 1);

  const third = await limiter.check('user:1');
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);

  const blocked = await limiter.check('user:1');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterMs >= 1);
});

test('memory limiter keys are independent across identifiers', async () => {
  const limiter = new RateLimiter({ max: 1, windowMs: 60_000, memoryOnly: true });
  await limiter.check('user:a');
  const other = await limiter.check('user:b');
  assert.equal(other.allowed, true);
  const again = await limiter.check('user:a');
  assert.equal(again.allowed, false);
});

test('limiter falls back to the in-memory window when Redis is unreachable', async () => {
  const limiter = new RateLimiter({ max: 2, windowMs: 60_000, redisUrl: 'redis://127.0.0.1:1' });
  const client = (limiter as unknown as { redis?: Redis }).redis;
  client?.on('error', () => undefined);

  const result = await limiter.check('fallback-key');
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 1);
  const second = await limiter.check('fallback-key');
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
  const third = await limiter.check('fallback-key');
  assert.equal(third.allowed, false);

  if (client) {
    client.disconnect();
  }
});