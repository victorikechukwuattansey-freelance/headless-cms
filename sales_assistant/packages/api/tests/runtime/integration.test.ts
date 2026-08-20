import './env.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Server } from 'node:http';

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

type DomainContext = { userId: string; organizationId: string; role: 'USER' | 'AGENT' | 'ADMIN' };

let prisma: Awaited<typeof import('../../src/lib/prisma.js')>['prisma'];
let AuthService: Awaited<typeof import('../../src/services/auth.service.js')>['AuthService'];
let AgentService: Awaited<typeof import('../../src/services/agent.service.js')>['AgentService'];
let LeadProfileService: Awaited<typeof import('../../src/services/lead-profile.service.js')>['LeadProfileService'];
let BookingService: Awaited<typeof import('../../src/services/booking.service.js')>['BookingService'];
let DealService: Awaited<typeof import('../../src/services/deal.service.js')>['DealService'];
let IntegrationTokenService: Awaited<typeof import('../../src/services/integration-token.service.js')>['IntegrationTokenService'];
let AiUsageService: Awaited<typeof import('../../src/services/ai-usage.service.js')>['AiUsageService'];
let QueueWorkerService: Awaited<typeof import('../../src/workers/queue-worker.service.js')>['QueueWorkerService'];
let createApp: Awaited<typeof import('../../src/app.js')>['createApp'];

let server: Server;
let baseUrl = '';
let auth: InstanceType<Awaited<typeof import('../../src/services/auth.service.js')>['AuthService']>;
let orgA = '';
let orgB = '';
let userA: DomainContext;
let userB: DomainContext;
let tokenA = '';
let tokenB = '';
let agent1 = '';
let agent2 = '';

const TABLES = [
  'DomainAuditEvent',
  'AiUsageLog',
  'IntegrationToken',
  'Booking',
  'Deal',
  'LeadProfile',
  'Agent',
  'User',
  'Organization',
];

async function resetTables(): Promise<void> {
  const quoted = TABLES.map((table) => `"${table}"`).join(',');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} CASCADE`);
}

async function seedAgents(orgId: string): Promise<{ agent1: string; agent2: string }> {
  const a1 = await prisma.agent.create({ data: { organizationId: orgId, name: 'Agent 1' } });
  const a2 = await prisma.agent.create({ data: { organizationId: orgId, name: 'Agent 2' } });
  return { agent1: a1.id, agent2: a2.id };
}

async function api(
  pathName: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${pathName}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}

before(async () => {
  const migrate = spawnSync('npm', ['run', 'db:migrate:deploy'], {
    cwd: API_DIR,
    shell: true,
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL! },
    encoding: 'utf8',
  });
  assert.equal(migrate.status, 0, `migrate deploy failed: ${migrate.stdout} ${migrate.stderr}`);

  const lib = await import('../../src/lib/prisma.js');
  prisma = lib.prisma;
  AuthService = (await import('../../src/services/auth.service.js')).AuthService;
  AgentService = (await import('../../src/services/agent.service.js')).AgentService;
  LeadProfileService = (await import('../../src/services/lead-profile.service.js')).LeadProfileService;
  BookingService = (await import('../../src/services/booking.service.js')).BookingService;
  DealService = (await import('../../src/services/deal.service.js')).DealService;
  IntegrationTokenService = (await import('../../src/services/integration-token.service.js')).IntegrationTokenService;
  AiUsageService = (await import('../../src/services/ai-usage.service.js')).AiUsageService;
  QueueWorkerService = (await import('../../src/workers/queue-worker.service.js')).QueueWorkerService;
  createApp = (await import('../../src/app.js')).createApp;

  auth = new AuthService();
  await resetTables();

  server = createApp();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  const limiter = (server as unknown as { rateLimiter?: { close(): Promise<void> } }).rateLimiter;
  await limiter?.close();
  const { closeJobQueue } = await import('../../src/workers/job-queue.js');
  await closeJobQueue();
  server.close();
  server.closeIdleConnections();
  await prisma?.$disconnect();
});

beforeEach(async () => {
  await resetTables();
  const orgARecord = await prisma.organization.create({ data: { name: 'Org A' } });
  orgA = orgARecord.id;
  const orgBRecord = await prisma.organization.create({ data: { name: 'Org B' } });
  orgB = orgBRecord.id;
  userA = { userId: 'user-a', organizationId: orgA, role: 'ADMIN' };
  userB = { userId: 'user-b', organizationId: orgB, role: 'ADMIN' };
  tokenA = auth.issueToken(userA);
  tokenB = auth.issueToken(userB);
  const agents = await seedAgents(orgA);
  agent1 = agents.agent1;
  agent2 = agents.agent2;
});

test('GET /health and /metrics respond without auth', async () => {
  const health = await api('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.json, { ok: true });

  const response = await fetch(`${baseUrl}/metrics`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /http_requests_total/);
});

test('auth middleware rejects missing and invalid tokens over HTTP', async () => {
  const missing = await api('/leads');
  assert.equal(missing.status, 401);
  assert.equal(missing.json.error.code, 'UNAUTHORIZED');

  const invalid = await api('/leads', { token: 'garbage-token' });
  assert.equal(invalid.status, 401);
  assert.equal(invalid.json.error.code, 'UNAUTHORIZED');

  const valid = await api('/leads', { token: tokenA });
  assert.equal(valid.status, 200);
  assert.deepEqual(valid.json.data, []);
});

test('lead lifecycle over HTTP: create, invalid transition, assign, update', async () => {
  const created = await api('/leads', {
    method: 'POST',
    token: tokenA,
    body: { phone: '+2348000000001', name: 'Grace', score: 40 },
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.data.status, 'new');
  const leadId = created.json.data.id;

  const invalidTransition = await api(`/leads/${leadId}`, {
    method: 'PATCH',
    token: tokenA,
    body: { status: 'converted' },
  });
  assert.equal(invalidTransition.status, 409);
  assert.equal(invalidTransition.json.error.code, 'INVALID_TRANSITION');

  const assigned = await api(`/leads/${leadId}/assign`, { method: 'POST', token: tokenA });
  assert.equal(assigned.status, 200);
  assert.equal(assigned.json.data.status, 'assigned');
  assert.equal(assigned.json.data.agentId, agent1);

  const updated = await api(`/leads/${leadId}`, {
    method: 'PATCH',
    token: tokenA,
    body: { score: 70 },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.score, 70);
});

test('least-loaded assignment picks the idle agent with fewer active leads', async () => {
  const lead1 = await prisma.leadProfile.create({
    data: { organizationId: orgA, phone: '+2348000000002', agentId: agent1, status: 'assigned' },
  });
  const service = new LeadProfileService();
  const assigned = await service.assign({ ...userA, userId: 'user-1' }, lead1.id);
  assert.equal(assigned.agentId, agent2);
});

test('resource policy blocks cross-organization access over HTTP and service', async () => {
  const leadA = await prisma.leadProfile.create({
    data: { organizationId: orgA, phone: '+2348000000003' },
  });

  const crossOrgHttp = await api(`/leads/${leadA.id}`, { token: tokenB });
  assert.equal(crossOrgHttp.status, 404);
  assert.equal(crossOrgHttp.json.error.code, 'NOT_FOUND');

  const policy = (await import('../../src/domain/resource-policy.service.js')).assertSameOrganization;
  assert.throws(
    () => policy(orgB, { organizationId: orgA }, 'LeadProfile'),
    (err: unknown) => err instanceof Error && err.name === 'DomainError',
  );
});

test('booking transitions: pending -> confirmed -> completed, invalid skips rejected', async () => {
  const lead = await prisma.leadProfile.create({ data: { organizationId: orgA, phone: '+2348000000004' } });
  const service = new BookingService();

  const booking = await service.create(userA, { leadId: lead.id, at: new Date(Date.now() + 86_400_000) });
  assert.equal(booking.status, 'pending');

  await assert.rejects(
    () => service.transitionStatus(userA, booking.id, 'completed'),
    (err: unknown) => err instanceof Error && (err as { code?: string }).code === 'INVALID_TRANSITION',
  );

  const confirmed = await service.transitionStatus(userA, booking.id, 'confirmed');
  assert.equal(confirmed.status, 'confirmed');
  const completed = await service.transitionStatus(userA, booking.id, 'completed');
  assert.equal(completed.status, 'completed');

  const auditCount = await prisma.domainAuditEvent.count({
    where: { organizationId: orgA, eventType: 'BOOKING_STATUS_CHANGED' },
  });
  assert.equal(auditCount, 2);
});

test('booking endpoint over HTTP: create and transition', async () => {
  const lead = await prisma.leadProfile.create({ data: { organizationId: orgA, phone: '+2348000000005' } });
  const created = await api('/bookings', {
    method: 'POST',
    token: tokenA,
    body: { leadId: lead.id, at: new Date(Date.now() + 86_400_000).toISOString() },
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.data.status, 'pending');

  const transitioned = await api(`/bookings/${created.json.data.id}/transition`, {
    method: 'POST',
    token: tokenA,
    body: { status: 'confirmed' },
  });
  assert.equal(transitioned.status, 200);
  assert.equal(transitioned.json.data.status, 'confirmed');
});

test('deal transitions: proposed -> won, invalid targets rejected', async () => {
  const service = new DealService();
  const deal = await service.create(userA, { amount: 150_000 });
  assert.equal(deal.stage, 'proposed');

  await assert.rejects(
    () => service.transitionStage(userA, deal.id, 'completed' as never),
    (err: unknown) => err instanceof Error && (err as { code?: string }).code === 'INVALID_TRANSITION',
  );

  const won = await service.transitionStage(userA, deal.id, 'won');
  assert.equal(won.stage, 'won');

  const auditCount = await prisma.domainAuditEvent.count({
    where: { organizationId: orgA, eventType: 'DEAL_STAGE_CHANGED' },
  });
  assert.equal(auditCount, 1);
});

test('deal endpoints over HTTP: create, validate, and transition', async () => {
  const created = await api('/deals', { method: 'POST', token: tokenA, body: { amount: 90_000 } });
  assert.equal(created.status, 201);
  assert.equal(created.json.data.stage, 'proposed');
  assert.equal(created.json.data.amount, 90_000);

  const nonStage = await api(`/deals/${created.json.data.id}/transition`, {
    method: 'POST',
    token: tokenA,
    body: { stage: 'completed' },
  });
  assert.equal(nonStage.status, 400);
  assert.equal(nonStage.json.error.code, 'VALIDATION');

  const won = await api(`/deals/${created.json.data.id}/transition`, {
    method: 'POST',
    token: tokenA,
    body: { stage: 'won' },
  });
  assert.equal(won.status, 200);
  assert.equal(won.json.data.stage, 'won');

  const terminal = await api(`/deals/${created.json.data.id}/transition`, {
    method: 'POST',
    token: tokenA,
    body: { stage: 'lost' },
  });
  assert.equal(terminal.status, 409);
  assert.equal(terminal.json.error.code, 'INVALID_TRANSITION');
});

test('queue worker processes jobs and polls a source', async () => {
  const processed: string[] = [];
  let emitted = 0;
  const worker = new QueueWorkerService(
    new Map([
      [
        'lead.scored',
        async (job) => {
          processed.push(job.id);
        },
      ],
    ]),
    5,
    {
      receive: async () => {
        return emitted < 2 ? { id: `job-${emitted++}`, type: 'lead.scored' } : null;
      },
    },
  );

  await worker.processJob({ id: 'job-direct', type: 'lead.scored' });
  assert.deepEqual(processed, ['job-direct']);

  const startPromise = worker.start();
  await new Promise((resolve) => setTimeout(resolve, 60));
  worker.stop();
  await startPromise;
  assert.deepEqual(processed.sort(), ['job-0', 'job-1', 'job-direct']);
});

test('integration token service encrypts at rest and decrypts on retrieve', async () => {
  const service = new IntegrationTokenService();
  const stored = await service.store(userA, { provider: 'whatsapp', plaintextToken: 'super-secret-token' });

  const row = await prisma.integrationToken.findFirst({ where: { id: stored.id } });
  assert.ok(row);
  assert.ok(row!.encryptedAccessToken);
  assert.ok(row!.encryptedAccessToken!.includes('super-secret-token') === false, 'no plaintext at rest');
  assert.equal(row!.tokenHash?.length, 64);

  const retrieved = await service.retrieve(userA, stored.id);
  assert.equal(retrieved.plaintextToken, 'super-secret-token');

  const list = await service.list(userA);
  assert.equal(list.length, 1);
  assert.ok(list[0] && 'encryptedAccessToken' in list[0] === false, 'list never exposes ciphertext');
});

test('AI usage logging records tokens, cost, and audit events', async () => {
  const service = new AiUsageService();
  const result = await service.complete(userA, {
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Summarize this lead' }],
  });

  assert.ok(result.content.length > 0);
  assert.ok(result.tokensIn > 0 && result.tokensOut > 0);
  assert.ok(result.cost > 0);

  const log = await prisma.aiUsageLog.findFirst({ where: { organizationId: orgA } });
  assert.ok(log);
  assert.equal(log!.model, 'gpt-4o-mini');
  assert.equal(log!.tokensIn, result.tokensIn);

  const audit = await prisma.domainAuditEvent.findFirst({
    where: { organizationId: orgA, eventType: 'AI_USAGE_LOGGED' },
  });
  assert.ok(audit);
});

test('list endpoints paginate and filter via query params', async () => {
  const leadA = await prisma.leadProfile.create({ data: { organizationId: orgA, phone: '+2348000000111' } });
  const leadB = await prisma.leadProfile.create({
    data: { organizationId: orgA, phone: '+2348000000222', status: 'converted' },
  });
  const leadC = await prisma.leadProfile.create({
    data: { organizationId: orgA, phone: '+2348000000333', status: 'converted' },
  });
  const leadD = await prisma.leadProfile.create({
    data: { organizationId: orgA, phone: '+2348000000777', agentId: agent1 },
  });

  const paged = await api('/leads?limit=2&offset=1', { token: tokenA });
  assert.equal(paged.status, 200);
  assert.equal(paged.json.total, 4);
  assert.equal(paged.json.limit, 2);
  assert.equal(paged.json.offset, 1);
  assert.equal(paged.json.data.length, 2);

  const filtered = await api('/leads?status=converted', { token: tokenA });
  assert.equal(filtered.json.total, 2);
  assert.ok(filtered.json.data.every((lead: { id: string }) => [leadB.id, leadC.id].includes(lead.id)));

  const byAgent = await api(`/leads?agentId=${agent1}`, { token: tokenA });
  assert.equal(byAgent.json.total, 1);
  assert.equal(byAgent.json.data[0].id, leadD.id);
  assert.equal(byAgent.json.data[0].agentId, agent1);
  assert.ok(byAgent.json.data[0].agent !== null);
});

test('agent, booking, and deal lists filter and page', async () => {
  await prisma.agent.update({ where: { id: agent1 }, data: { status: 'busy' } });
  const available = await api('/agents?available=true&limit=10', { token: tokenA });
  assert.equal(available.json.total, 1);
  assert.equal(available.json.data[0].id, agent2);

  const lead = await prisma.leadProfile.create({ data: { organizationId: orgA, phone: '+2348000000444' } });
  const created = await api('/bookings', {
    method: 'POST',
    token: tokenA,
    body: { leadId: lead.id, at: new Date(Date.now() + 86_400_000).toISOString() },
  });
  await api(`/bookings/${created.json.data.id}/transition`, {
    method: 'POST',
    token: tokenA,
    body: { status: 'confirmed' },
  });
  const bookings = await api('/bookings?status=confirmed', { token: tokenA });
  assert.equal(bookings.json.total, 1);
  assert.equal(bookings.json.data[0].status, 'confirmed');

  await api('/deals', { method: 'POST', token: tokenA, body: { amount: 10_000 } });
  await api('/deals', { method: 'POST', token: tokenA, body: { amount: 20_000, stage: 'won' } });
  const deals = await api('/deals?stage=won', { token: tokenA });
  assert.equal(deals.json.total, 1);
  assert.equal(deals.json.data[0].amount, 20_000);
});

test('validation errors return a structured 400 shape', async () => {
  const missingPhone = await api('/leads', { method: 'POST', token: tokenA, body: {} });
  assert.equal(missingPhone.status, 400);
  assert.equal(missingPhone.json.error.code, 'VALIDATION');
  assert.ok(typeof missingPhone.json.error.message === 'string' && missingPhone.json.error.message.length > 0);
  assert.match(missingPhone.json.error.message, /phone/);

  const badScore = await api('/leads', { method: 'POST', token: tokenA, body: { phone: '+2348000000555', score: 3.5 } });
  assert.equal(badScore.status, 400);
  assert.equal(badScore.json.error.code, 'VALIDATION');

  const badDate = await api('/bookings', { method: 'POST', token: tokenA, body: { leadId: 'lead-x', at: 'nope' } });
  assert.equal(badDate.status, 400);
  assert.equal(badDate.json.error.code, 'VALIDATION');

  const badLimit = await api('/leads?limit=999', { token: tokenA });
  assert.equal(badLimit.status, 400);
  assert.equal(badLimit.json.error.code, 'VALIDATION');

  const badAvailability = await api(`/agents/${agent1}/availability`, {
    method: 'POST',
    token: tokenA,
    body: { available: 'yes' },
  });
  assert.equal(badAvailability.status, 400);
  assert.equal(badAvailability.json.error.code, 'VALIDATION');
});

test('redis queue worker processes enqueued jobs and writes audit events', async () => {
  const { RedisJobSource } = await import('../../src/workers/redis-job-source.js');
  const source = new RedisJobSource({ url: process.env.REDIS_URL!, blockTimeoutSeconds: 1 });
  await source.connect();
  await source.redis.flushdb();

  const worker = new QueueWorkerService(
    new Map([
      [
        'lead.import',
        async (job) => {
          const payload = job.payload as { phone: string; organizationId: string };
          await prisma.leadProfile.create({
            data: { organizationId: payload.organizationId, phone: payload.phone },
          });
          const { writeAuditEvent } = await import('../../src/services/audit.service.js');
          await writeAuditEvent(
            { userId: 'queue-worker', organizationId: payload.organizationId, role: 'ADMIN' },
            'LEAD_IMPORTED',
            { jobId: job.id },
          );
        },
      ],
    ]),
    25,
    source,
  );

  await source.enqueue({
    id: 'job-import-1',
    type: 'lead.import',
    payload: { phone: '+2348000000666', organizationId: orgA },
  });

  const startPromise = worker.start();
  const deadline = Date.now() + 10_000;
  let auditFound = false;
  while (Date.now() < deadline) {
    const count = await prisma.domainAuditEvent.count({ where: { eventType: 'LEAD_IMPORTED' } });
    if (count >= 1) {
      auditFound = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  worker.stop();
  await startPromise;
  await source.close().catch(() => undefined);

  assert.equal(auditFound, true, 'worker should process the queued job');
  const lead = await prisma.leadProfile.findFirst({ where: { phone: '+2348000000666' } });
  assert.ok(lead);
});

test('redis queue worker survives failed jobs and still processes later ones', async () => {
  const { RedisJobSource } = await import('../../src/workers/redis-job-source.js');
  const source = new RedisJobSource({ url: process.env.REDIS_URL!, blockTimeoutSeconds: 1 });
  await source.connect();
  await source.redis.flushdb();

  const processed: string[] = [];
  const worker = new QueueWorkerService(
    new Map([
      ['flaky', async () => { throw new Error('boom'); }],
      [
        'ok',
        async (job) => {
          processed.push(job.id);
          const { writeAuditEvent } = await import('../../src/services/audit.service.js');
          await writeAuditEvent(
            { userId: 'queue-worker', organizationId: orgA, role: 'ADMIN' },
            'QUEUE_OK',
            { jobId: job.id },
          );
        },
      ],
    ]),
    25,
    source,
    2,
    10,
  );

  await source.enqueue({ id: 'job-flaky', type: 'flaky' });
  await source.enqueue({ id: 'job-ok', type: 'ok' });

  const startPromise = worker.start();
  const deadline = Date.now() + 10_000;
  let auditFound = false;
  while (Date.now() < deadline) {
    if (processed.includes('job-ok')) {
      const count = await prisma.domainAuditEvent.count({ where: { eventType: 'QUEUE_OK' } });
      if (count >= 1) {
        auditFound = true;
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  worker.stop();
  await startPromise;
  await source.close().catch(() => undefined);

  assert.equal(auditFound, true, 'worker should survive the failed job and process the ok job');
});

test('AiUsageService honors an injected provider', async () => {
  const { MockAiProvider } = await import('../../src/ai/mock-provider.js');
  const service = new AiUsageService(new MockAiProvider());
  const result = await service.complete(userA, {
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Inject me' }],
  });

  assert.ok(result.content.length > 0);
  const log = await prisma.aiUsageLog.findFirst({ where: { organizationId: orgA, model: 'gpt-4o-mini' } });
  assert.ok(log);
});

test('auth token endpoint issues a working token and rejects bad credentials', async () => {
  await prisma.user.create({
    data: {
      organizationId: orgA,
      email: 'admin@acme.test',
      name: 'Admin User',
      role: 'ADMIN',
      passwordHash: await auth.hashPassword('password123'),
    },
  });

  const ok = await api('/auth/token', {
    method: 'POST',
    body: { email: 'admin@acme.test', password: 'password123' },
  });
  assert.equal(ok.status, 200);
  assert.ok(typeof ok.json.token === 'string' && ok.json.token.includes('.'));
  assert.ok(typeof ok.json.expiresAt === 'string' && !Number.isNaN(Date.parse(ok.json.expiresAt)));
  assert.equal(ok.json.role, 'ADMIN');

  const leads = await api('/leads', { token: ok.json.token });
  assert.equal(leads.status, 200);

  const wrongPassword = await api('/auth/token', {
    method: 'POST',
    body: { email: 'admin@acme.test', password: 'wrong-password' },
  });
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongPassword.json.error.code, 'UNAUTHORIZED');

  const unknownEmail = await api('/auth/token', {
    method: 'POST',
    body: { email: 'nobody@acme.test', password: 'password123' },
  });
  assert.equal(unknownEmail.status, 401);

  const invalidBody = await api('/auth/token', {
    method: 'POST',
    body: { email: 'not-an-email', password: '' },
  });
  assert.equal(invalidBody.status, 400);
  assert.equal(invalidBody.json.error.code, 'VALIDATION');
});

test('user management endpoints are admin-only, org-scoped, and never expose password hashes', async () => {
  const list = await api('/users', { token: tokenA });
  assert.equal(list.status, 200);
  assert.equal(list.json.total, 0);
  assert.deepEqual(Object.keys(list.json), ['data', 'total', 'limit', 'offset']);

  const regular = await prisma.user.create({
    data: { organizationId: orgA, email: 'user@acme.test', role: 'USER' },
  });
  const userToken = auth.issueToken({ userId: regular.id, organizationId: orgA, role: 'USER' });

  const forbidden = await api('/users', { token: userToken });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.json.error.code, 'FORBIDDEN');

  const created = await api('/users', {
    method: 'POST',
    token: tokenA,
    body: { email: 'agent@acme.test', password: 'password123', name: 'Agent User', role: 'AGENT' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.data.email, 'agent@acme.test');
  assert.equal(created.json.data.role, 'AGENT');
  assert.ok('passwordHash' in created.json.data === false, 'password hash must never be exposed');

  const patched = await api(`/users/${created.json.data.id}`, {
    method: 'PATCH',
    token: tokenA,
    body: { role: 'USER' },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.json.data.role, 'USER');
  assert.ok('passwordHash' in patched.json.data === false);

  const emptyPatch = await api(`/users/${created.json.data.id}`, {
    method: 'PATCH',
    token: tokenA,
    body: {},
  });
  assert.equal(emptyPatch.status, 400);
  assert.equal(emptyPatch.json.error.code, 'VALIDATION');

  const duplicate = await api('/users', {
    method: 'POST',
    token: tokenA,
    body: { email: 'agent@acme.test', password: 'password123' },
  });
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.json.error.code, 'VALIDATION');

  const crossOrg = await api(`/users/${created.json.data.id}`, {
    method: 'PATCH',
    token: tokenB,
    body: { role: 'ADMIN' },
  });
  assert.equal(crossOrg.status, 404);
  assert.equal(crossOrg.json.error.code, 'NOT_FOUND');
});

test('lead scoring endpoint persists score, reason, and audit event', async () => {
  const lead = await prisma.leadProfile.create({
    data: { organizationId: orgA, phone: '+2348000000888', score: 40 },
  });

  const scored = await api(`/leads/${lead.id}/score`, { method: 'POST', token: tokenA });
  assert.equal(scored.status, 200);
  assert.ok(scored.json.data.score >= 0 && scored.json.data.score <= 100);
  assert.ok(typeof scored.json.data.scoreReason === 'string' && scored.json.data.scoreReason.length > 0);
  assert.ok(scored.json.data.lastScoredAt, 'lastScoredAt should be set after scoring');

  const audit = await prisma.domainAuditEvent.findFirst({
    where: { organizationId: orgA, eventType: 'LEAD_SCORED' },
  });
  assert.ok(audit);
  assert.equal((audit!.payload as { source: string }).source, 'fallback');

  const crossOrg = await api(`/leads/${lead.id}/score`, { method: 'POST', token: tokenB });
  assert.equal(crossOrg.status, 404);
  assert.equal(crossOrg.json.error.code, 'NOT_FOUND');

  const missing = await api('/leads/lead-missing/score', { method: 'POST', token: tokenA });
  assert.equal(missing.status, 404);
});

test('follow-up reminders list, filter, and generate endpoint (admin-only)', async () => {
  const stale = await prisma.leadProfile.create({
    data: {
      organizationId: orgA,
      phone: '+2348000000999',
      lastContactedAt: new Date(Date.now() - 30 * 86_400_000),
    },
  });
  await prisma.followUpReminder.create({
    data: { organizationId: orgA, leadId: stale.id, dueAt: new Date(Date.now() + 86_400_000), message: 'Follow up with lead' },
  });

  const list = await api('/reminders', { token: tokenA });
  assert.equal(list.status, 200);
  assert.equal(list.json.total, 1);
  assert.equal(list.json.data[0].leadId, stale.id);

  const filtered = await api('/reminders?status=pending', { token: tokenA });
  assert.equal(filtered.status, 200);
  assert.equal(filtered.json.total, 1);

  const dismissed = await api('/reminders?status=dismissed', { token: tokenA });
  assert.equal(dismissed.status, 200);
  assert.equal(dismissed.json.total, 0);

  const regular = await prisma.user.create({
    data: { organizationId: orgA, email: 'user2@acme.test', role: 'USER' },
  });
  const userToken = auth.issueToken({ userId: regular.id, organizationId: orgA, role: 'USER' });
  const forbidden = await api('/reminders/generate', { method: 'POST', token: userToken });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.json.error.code, 'FORBIDDEN');

  const generated = await api('/reminders/generate', { method: 'POST', token: tokenA });
  assert.equal(generated.status, 202);
  assert.equal(generated.json.data.queued, true);
  assert.ok(typeof generated.json.data.jobId === 'string');
});

test('reminder dismiss endpoint flips status, audits, and is org-scoped', async () => {
  const lead = await prisma.leadProfile.create({ data: { organizationId: orgA, phone: '+2348000001000' } });
  const reminder = await prisma.followUpReminder.create({
    data: { organizationId: orgA, leadId: lead.id, dueAt: new Date(Date.now() + 86_400_000), message: 'Follow up with lead' },
  });

  const dismissed = await api(`/reminders/${reminder.id}/dismiss`, { method: 'POST', token: tokenA });
  assert.equal(dismissed.status, 200);
  assert.equal(dismissed.json.data.id, reminder.id);
  assert.equal(dismissed.json.data.status, 'dismissed');

  const audit = await prisma.domainAuditEvent.findFirst({
    where: { organizationId: orgA, eventType: 'REMINDER_DISMISSED' },
  });
  assert.ok(audit);

  const crossOrg = await api(`/reminders/${reminder.id}/dismiss`, { method: 'POST', token: tokenB });
  assert.equal(crossOrg.status, 404);
  assert.equal(crossOrg.json.error.code, 'NOT_FOUND');

  const missing = await api('/reminders/reminder-missing/dismiss', { method: 'POST', token: tokenA });
  assert.equal(missing.status, 404);
});

test('docs and openapi.json are served without auth', async () => {
  const spec = await api('/openapi.json');
  assert.equal(spec.status, 200);
  assert.equal(spec.json.openapi, '3.0.3');
  assert.ok(spec.json.paths['/auth/token']);
  assert.ok(spec.json.paths['/users']);
  assert.ok(spec.json.paths['/leads/{id}/score']);
  assert.ok(spec.json.paths['/reminders/generate']);
  assert.ok(spec.json.paths['/reminders/{id}/dismiss']);
  assert.ok(spec.json.paths['/docs']);
  assert.ok(spec.json.components.securitySchemes.bearerAuth);

  const docs = await fetch(`${baseUrl}/docs`);
  assert.equal(docs.status, 200);
  const html = await docs.text();
  assert.match(html, /redoc/i);
  assert.match(html, /openapi\.json/);
});

test('rate limiter returns 429 with retry-after when quota is exhausted and exempts public routes', async () => {
  const { RateLimiter } = await import('../../src/middleware/rate-limit.js');
  const limited = createApp({ rateLimiter: new RateLimiter({ max: 2, windowMs: 60_000, memoryOnly: true }) });
  await new Promise<void>((resolve) => limited.listen(0, '127.0.0.1', () => resolve()));
  const address = limited.address();
  assert.ok(address && typeof address === 'object');
  const limitedUrl = `http://127.0.0.1:${address.port}`;

  try {
    const first = await fetch(`${limitedUrl}/leads`, { headers: { authorization: `Bearer ${tokenA}` } });
    assert.equal(first.status, 200);
    const second = await fetch(`${limitedUrl}/leads`, { headers: { authorization: `Bearer ${tokenA}` } });
    assert.equal(second.status, 200);

    const blocked = await fetch(`${limitedUrl}/leads`, { headers: { authorization: `Bearer ${tokenA}` } });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
    assert.equal(blocked.headers.get('x-ratelimit-limit'), '2');
    const body = await blocked.json();
    assert.equal(body.error.code, 'RATE_LIMITED');

    const exempt = await fetch(`${limitedUrl}/health`);
    assert.equal(exempt.status, 200);
    const docs = await fetch(`${limitedUrl}/docs`);
    assert.equal(docs.status, 200);
    const spec = await fetch(`${limitedUrl}/openapi.json`);
    assert.equal(spec.status, 200);
  } finally {
    limited.close();
    limited.closeIdleConnections();
  }
});

test('audit events feed is org-scoped, newest-first, filterable, and admin-only', async () => {
  const lead = await api('/leads', {
    token: tokenA,
    method: 'POST',
    body: { phone: '+2349009000001' },
  });
  assert.equal(lead.status, 201);

  const events = await api('/audit-events', { token: tokenA });
  assert.equal(events.status, 200);
  assert.equal(events.json.data.length, 1);
  assert.equal(events.json.data[0].eventType, 'LEAD_CREATED');
  assert.equal(events.json.data[0].payload.leadId, lead.json.data.id);

  const ordered = await api('/audit-events?limit=5', { token: tokenA });
  const stamps = ordered.json.data.map((e: { createdAt: string }) => new Date(e.createdAt).getTime());
  assert.deepEqual(stamps, [...stamps].sort((a, b) => b - a));

  const filtered = await api('/audit-events?type=LEAD_CREATED', { token: tokenA });
  assert.ok(filtered.json.data.length >= 1);
  assert.ok(filtered.json.data.every((e: { eventType: string }) => e.eventType === 'LEAD_CREATED'));

  const crossOrg = await api('/audit-events', { token: tokenB });
  assert.equal(crossOrg.status, 200);
  assert.equal(crossOrg.json.data.length, 0);

  const userToken = auth.issueToken({ userId: 'user-x', organizationId: orgA, role: 'USER' });
  const forbidden = await api('/audit-events', { token: userToken });
  assert.equal(forbidden.status, 403);

  const badType = await api('/audit-events?type=NOPE', { token: tokenA });
  assert.equal(badType.status, 400);
  assert.equal(badType.json.error.code, 'VALIDATION');
});
