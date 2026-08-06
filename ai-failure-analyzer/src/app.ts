import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { analyzeRouter } from './routes/analyze.routes.js';
import { reportsRouter } from './routes/reports.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '12mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', analyzeRouter());
  app.use('/api', reportsRouter);

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
