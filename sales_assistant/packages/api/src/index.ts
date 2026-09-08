import { createApp } from './app.js';
import { assertProductionSecrets } from './lib/env-guard.js';
import { structuredLogger } from './observability/logger.js';

assertProductionSecrets();

const port = Number(process.env.PORT ?? 3000);
createApp().listen(port, () => {
  structuredLogger.info('api.started', { port });
});