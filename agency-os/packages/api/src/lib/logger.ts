import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  name: 'agency-os-api',
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'agency-os-api',
    env: process.env.NODE_ENV || 'development',
  },
   ...(isDevelopment && {
  transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
}),
});

export const slowQueryThresholdMs = Number.parseInt(
  process.env.SLOW_QUERY_THRESHOLD_MS || '500',
  10
);

