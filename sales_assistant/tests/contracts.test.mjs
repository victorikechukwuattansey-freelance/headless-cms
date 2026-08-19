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

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('API contract: auth, users, scoring, reminders, docs, and rate limits', () => {
  it('openapi spec exists and covers the full auth/docs/reminder surface', async () => {
    const spec = await readRepoFile('packages/openapi/openapi.yaml');
    for (const route of ['/auth/token', '/users', '/leads/{id}/score', '/reminders', '/reminders/generate', '/openapi.json', '/docs', '/health']) {
      assert.match(spec, new RegExp(escapeRegExp(route)), `spec must document ${route}`);
    }
    assert.match(spec, /openapi: 3\.0\.3/);
    assert.match(spec, /securitySchemes:/);
    assert.match(spec, /bearerAuth:/);
    assert.match(spec, /RATE_LIMITED/);
    assert.match(spec, /Retry-After/);
    assert.match(spec, /429/);
  });

  it('openapi loader resolves the yaml spec from src', async () => {
    const loader = await readRepoFile('packages/api/src/openapi.ts');
    assert.match(loader, /getOpenApiSpec/);
    assert.match(loader, /openapi\.yaml/);
    assert.match(loader, /YAML\.parse/);
    const specPath = 'packages/openapi/openapi.yaml';
    assert.ok(existsSync(path.join(root, specPath)), `expected ${specPath} to exist`);
  });

  it('domain errors cover auth, transitions, and rate limiting statuses', async () => {
    const errors = await readRepoFile('packages/api/src/domain/domain-error.ts');
    for (const code of ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'INVALID_TRANSITION', 'NO_AGENT_AVAILABLE', 'VALIDATION', 'RATE_LIMITED']) {
      assert.match(errors, new RegExp(code));
    }
    assert.match(errors, /401/);
    assert.match(errors, /403/);
    assert.match(errors, /409/);
    assert.match(errors, /429/);
  });

  it('rate limiter supports redis with an in-memory fallback and retry-after', async () => {
    const limiter = await readRepoFile('packages/api/src/middleware/rate-limit.ts');
    assert.match(limiter, /new Redis\(/);
    assert.match(limiter, /lazyConnect/);
    assert.match(limiter, /checkMemory/);
    assert.match(limiter, /retryAfterMs/);
    assert.match(limiter, /RATE_LIMIT_MAX/);
    assert.match(limiter, /RATE_LIMIT_WINDOW_MS/);

    const envExample = await readRepoFileMaybe('.env.example');
    assert.match(envExample, /RATE_LIMIT_MAX=/);
    assert.match(envExample, /RATE_LIMIT_WINDOW_MS=/);
    assert.match(envExample, /FOLLOW_UP_THRESHOLD_DAYS=/);
    assert.match(envExample, /FOLLOW_UP_DUE_HOURS=/);
  });

  it('app wiring exposes auth, users, scoring, reminders, docs, and rate limiting', async () => {
    const app = await readRepoFile('packages/api/src/app.ts');
    for (const needle of ['auth/token', 'openapi.json', 'docs', 'RATE_LIMITED', 'retry-after', 'requireRole', 'generate-follow-up-reminders', 'LeadScoreService', 'FollowUpReminderService']) {
      assert.match(app, new RegExp(escapeRegExp(needle)));
    }
    assert.match(app, /issueTokenWithExpiry|issueToken/);
    assert.match(app, /verifyPassword/);
    assert.match(app, /RateLimiter/);
    assert.match(app, /x-ratelimit-limit/);
  });

  it('auth and user services hash passwords without exposing hashes in responses', async () => {
    const auth = await readRepoFile('packages/api/src/services/auth.service.ts');
    assert.match(auth, /bcrypt/);
    assert.match(auth, /hashPassword/);
    assert.match(auth, /verifyPassword/);
    assert.match(auth, /issueTokenWithExpiry/);

    const users = await readRepoFile('packages/api/src/services/user.service.ts');
    assert.match(users, /SAFE_SELECT/);
    assert.ok(!/passwordHash: true/.test(users), 'safe select must never expose passwordHash');
    const app = await readRepoFile('packages/api/src/app.ts');
    assert.match(app, /passwordHash/);

    const seed = await readRepoFile('packages/api/prisma/seed.ts');
    assert.match(seed, /bcrypt/);
    assert.match(seed, /passwordHash/);
    assert.match(seed, /upsert/);
  });

  it('lead scoring and follow-up reminder services persist results and audit', async () => {
    const scoring = await readRepoFile('packages/api/src/services/lead-score.service.ts');
    assert.match(scoring, /LEAD_SCORED/);
    assert.match(scoring, /scoreReason/);
    assert.match(scoring, /lastScoredAt/);
    assert.match(scoring, /parseScoreJson/);
    assert.match(scoring, /writeAuditEvent/);

    const reminders = await readRepoFile('packages/api/src/services/follow-up-reminder.service.ts');
    assert.match(reminders, /BULK_REMINDERS_GENERATED/);
    assert.match(reminders, /FOLLOW_UP_THRESHOLD_DAYS/);
    assert.match(reminders, /FOLLOW_UP_DUE_HOURS/);

    const workers = await readRepoFile('packages/api/src/workers/handlers.ts');
    assert.match(workers, /score-lead/);
    assert.match(workers, /generate-follow-up-reminders/);
  });
});