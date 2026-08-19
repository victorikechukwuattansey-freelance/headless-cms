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

describe('enterprise readiness foundation', () => {
  it('declares an organization ownership boundary on core backend models', async () => {
    const schema = await readRepoFile('packages/api/prisma/schema.prisma');

    assert.match(schema, /model Organization\s*\{/);

    for (const model of [
      'User',
      'LeadProfile',
      'Agent',
      'Property',
      'Booking',
      'Deal',
      'IntegrationToken',
      'DomainCommandExecution',
      'DomainAuditEvent',
      'AiUsageLog',
    ]) {
      const modelBlock = schema.match(new RegExp(`model ${model}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0] ?? '';
      assert.match(modelBlock, /organizationId\s+String\b/, `${model} must require organizationId`);
      assert.match(modelBlock, /organization\s+Organization\b/, `${model} must require Organization`);
      assert.match(modelBlock, /@@index\(\[organizationId/, `${model} must index organizationId`);
    }
  });

  it('propagates organization context through auth and domain policy code', async () => {
    const authenticate = await readRepoFile('packages/api/src/middleware/authenticate.ts');
    const authService = await readRepoFile('packages/api/src/services/auth.service.ts');
    const domainContext = await readRepoFile('packages/api/src/domain/domain-context.ts');
    const policy = await readRepoFile('packages/api/src/domain/resource-policy.service.ts');

    assert.match(authenticate, /organizationId:\s*string/);
    assert.match(authenticate, /requireOrganizationId\(organizationId,\s*'authenticated request'\)/);
    assert.match(authService, /organizationId/);
    assert.match(domainContext, /organizationId:\s*string/);
    assert.match(domainContext, /requireOrganizationId\(input\.organizationId,\s*'domain context'\)/);
    assert.match(policy, /assertSameOrganization|organizationId/);
  });

  it('adds source-control and CI guardrails for secrets', async () => {
    const gitignore = await readRepoFileMaybe('.gitignore');
    const envExample = await readRepoFileMaybe('.env.example');
    const compose = await readRepoFile('docker-compose.yml');
    const ci = await readRepoFile('.github/workflows/ci.yml');

    assert.match(gitignore, /^\.env$/m);
    assert.match(gitignore, /^\.env\.\*$/m);
    assert.match(gitignore, /^!\.env\.example$/m);
    assert.match(envExample, /JWT_SECRET=/);
    assert.match(envExample, /INTEGRATION_TOKEN_ENCRYPTION_KEY=/);
    assert.match(compose, /\$\{POSTGRES_PASSWORD/);
    assert.match(ci, /gitleaks/i);
  });

  it('stores integration and refresh tokens using protected forms for new writes', async () => {
    const schema = await readRepoFile('packages/api/prisma/schema.prisma');
    const integrationGateway = await readRepoFile('packages/api/src/integrations/integration-gateway.service.ts');
    const authService = await readRepoFile('packages/api/src/services/auth.service.ts');

    assert.match(schema, /encryptedAccessToken\s+String\?/);
    assert.match(schema, /encryptionKeyVersion\s+Int/);
    assert.match(schema, /tokenHash\s+String\?/);
    assert.match(integrationGateway, /encryptSecret|decryptSecret/);
    assert.match(authService, /hashRefreshToken/);
  });

  it('exposes production observability hooks for requests, metrics, queues, and AI usage', async () => {
    const app = await readRepoFile('packages/api/src/app.ts');
    const metrics = await readRepoFileMaybe('packages/api/src/observability/metrics.ts');
    const worker = await readRepoFile('packages/api/src/workers/queue-worker.service.ts');
    const openai = await readRepoFile('packages/api/src/lib/openai.ts');
    const schema = await readRepoFile('packages/api/prisma/schema.prisma');

    assert.match(app, /structuredLogger/);
    assert.match(app, /\/metrics/);
    assert.match(metrics, /recordHttpRequest/);
    assert.match(metrics, /renderPrometheusMetrics/);
    assert.match(worker, /recordQueueJob|recordQueuePoll/);
    assert.match(openai, /recordAiUsage/);
    assert.match(schema, /model AiUsageLog\s*\{/);
  });
});
