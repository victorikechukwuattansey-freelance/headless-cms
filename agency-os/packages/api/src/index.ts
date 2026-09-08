import app from './app';
import './modules/auth/worker';
import { logger } from './lib/logger';

const port = Number.parseInt(process.env.PORT || '5000', 10);

const server = app.listen(port, () => {
  logger.info({ port }, 'agency-os API listening');
});

process.on('unhandledRejection', (error) => {
  logger.error({ err: error }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  server.close(() => process.exit(1));
});
