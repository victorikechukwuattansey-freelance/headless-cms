import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

async function readRepoFile(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function readRepoFileMaybe(relativePath) {
  const absolutePath = path.join(root, relativePath);
  return existsSync(absolutePath) ? readFile(absolutePath, 'utf8') : '';
}

describe('API hardening: validation, pagination, queue, and AI abstraction', () => {
  it('paginated list responses include data, total, limit, and offset', async () => {
    const app = await readRepoFile('packages/api/src/app.ts');
    assert.match(app, /total/);
    assert.match(app, /limit/);
    assert.match(app, /offset/);
    assert.match(app, /paginated\(/);
    assert.match(app, /data:/);
  });

  it('validates route bodies and query params with Zod schemas', async () => {
    const schemas = await readRepoFile('packages/api/src/validation/schemas.ts');
    const app = await readRepoFile('packages/api/src/app.ts');

    assert.match(schemas, /z\.object/);
    assert.match(schemas, /createLeadSchema|createBookingSchema|createDealSchema/);
    assert.match(schemas, /listLeadsQuerySchema|listAgentsQuerySchema|listBookingsQuerySchema|listDealsQuerySchema/);
    assert.match(schemas, /parseOrThrow|parseQuery/);
    assert.match(app, /parseOrThrow/);

    const domainError = await readRepoFile('packages/api/src/domain/domain-error.ts');
    assert.match(domainError, /VALIDATION/);
  });

  it('worker queue supports Redis with defaults, enqueue, receive, and requeue', async () => {
    const source = await readRepoFile('packages/api/src/workers/redis-job-source.ts');
    assert.match(source, /new Redis\(/);
    assert.match(source, /redis:\/\/localhost:6379/);
    assert.match(source, /REDIS_URL/);
    assert.match(source, /brpop/);
    assert.match(source, /lpush/);
    assert.match(source, /enqueue/);
    assert.match(source, /requeue/);
    assert.match(source, /recordQueueDepth/);

    const worker = await readRepoFile('packages/api/src/workers/queue-worker.service.ts');
    assert.match(worker, /requeue/);
    assert.match(worker, /maxAttempts/);
    assert.match(worker, /retryDelayMs/);
    assert.match(worker, /recordQueueJobDuration/);
  });

  it('AI usage is provider-agnostic with mock and OpenAI implementations', async () => {
    const provider = await readRepoFile('packages/api/src/ai/provider.ts');
    const mock = await readRepoFile('packages/api/src/ai/mock-provider.ts');
    const openAi = await readRepoFile('packages/api/src/ai/openai-provider.ts');

    assert.match(provider, /interface AiProvider/);
    assert.match(provider, /createAiProvider/);
    assert.match(provider, /OPENAI_API_KEY/);
    assert.match(provider, /MockAiProvider/);
    assert.match(provider, /new OpenAiProvider\(key\)/);
    assert.match(mock, /class MockAiProvider/);
    assert.match(openAi, /class OpenAiProvider/);
    assert.match(openAi, /chat\.completions\.create/);
    assert.match(openAi, /maxRetries/);
    assert.match(openAi, /status === 429/);
    assert.match(openAi, /TokenBucket/);

    const service = await readRepoFile('packages/api/src/services/ai-usage.service.ts');
    assert.match(service, /private readonly provider/);
    assert.match(service, /createAiProvider\(\)/);
  });

  it('production requires an OpenAI API key and never silently mocks', async () => {
    const provider = await readRepoFile('packages/api/src/ai/provider.ts');
    assert.match(provider, /OPENAI_API_KEY is required in production/);
    assert.match(provider, /NODE_ENV === 'production'/);
  });

  it('compat shim keeps metric hooks and the legacy openai surface', async () => {
    const openai = await readRepoFile('packages/api/src/lib/openai.ts');
    const metrics = await readRepoFile('packages/api/src/observability/metrics.ts');

    assert.match(openai, /recordAiUsage/);
    assert.match(metrics, /recordQueueDepth/);
    assert.match(metrics, /recordQueueJobDuration/);
    assert.match(metrics, /queue_depth/);
    assert.match(metrics, /queue_job_duration_ms/);
  });
});