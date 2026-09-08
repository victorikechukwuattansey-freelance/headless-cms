import { createApp } from './app.js';
import { prisma } from './db.js';

const port = Number(process.env.PORT ?? 3001);

const app = createApp();

const server = app.listen(port, () => {
  console.log(`AI Failure Analyzer listening on http://localhost:${port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
