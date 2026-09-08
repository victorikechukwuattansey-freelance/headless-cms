// packages/api/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { sendRedisCommand } from '../lib/redis';

export const rateLimiter = (max: number, windowMinutes: number) =>
  rateLimit({
    store: new RedisStore({
      sendCommand: sendRedisCommand,
    }),
    max,
    windowMs: windowMinutes * 60 * 1000,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
    message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests' } },
    standardHeaders: true,
    legacyHeaders: false
  });
