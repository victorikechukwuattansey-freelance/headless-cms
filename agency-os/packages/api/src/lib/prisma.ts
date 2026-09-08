import { Prisma, PrismaClient } from '@prisma/client';
import { logger, slowQueryThresholdMs } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __agencyOsPrisma__: PrismaClient | undefined;
}

const createPrismaClient = () => {
  
  
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'warn' },
    ],
  });

  client.$on('query', (event: { query: string; params: string; duration: number; timestamp: Date; target: string }) => {
    if (event.duration < slowQueryThresholdMs) {
      return;
    }

    logger.warn(
      {
        event: 'slow_query',
        durationMs: event.duration,
        target: event.target,
        query: event.query,
      },
      'Slow database query detected'
    );
  });

  return client;
};

export const prisma = globalThis.__agencyOsPrisma__ ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__agencyOsPrisma__ = prisma;
}

