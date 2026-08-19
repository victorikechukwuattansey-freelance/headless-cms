import { createApp } from './app.js';
import { structuredLogger } from './observability/logger.js';

const port = Number(process.env.PORT ?? 3000);
createApp().listen(port, () => {
  structuredLogger.info('api.started', { port });
});