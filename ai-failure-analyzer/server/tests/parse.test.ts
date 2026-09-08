import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { parseLog } from '../src/services/parser.service.js';
import { buildExecutionTimeline } from '../src/services/timeline.service.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const load = (name: string): string => readFileSync(path.join(fixtures, name), 'utf-8');

describe('buildExecutionTimeline', () => {
  it('maps a tool_call to tool + prompt', () => {
    const steps = buildExecutionTimeline([
      { index: 0, kind: 'tool_call', label: 'tool: apply_patch', content: '{"path":"a.ts"}', tokensIn: 100, tokensOut: 50 },
    ]);
    expect(steps[0]).toEqual({
      index: 0,
      timestamp: null,
      tool: 'apply_patch',
      prompt: '{"path":"a.ts"}',
      response: null,
      tokensIn: 100,
      tokensOut: 50,
      error: null,
    });
  });

  it('maps a response entry to response', () => {
    const steps = buildExecutionTimeline([{ index: 0, kind: 'response', label: 'message (assistant)', content: 'done' }]);
    expect(steps[0].response).toBe('done');
    expect(steps[0].tool).toBeNull();
    expect(steps[0].prompt).toBeNull();
  });

  it('maps a failure entry to error', () => {
    const steps = buildExecutionTimeline([
      { index: 0, kind: 'failure', label: 'tool: search', content: 'connection refused', outcome: 'error' },
    ]);
    expect(steps[0].error).toBe('connection refused');
    expect(steps[0].tool).toBe('search');
  });

  it('keeps the timestamp', () => {
    const steps = buildExecutionTimeline([
      { index: 0, kind: 'step', label: 'step', content: 'x', timestamp: '12:34:56' },
    ]);
    expect(steps[0].timestamp).toBe('12:34:56');
  });

  it('maps a user message to prompt', () => {
    const steps = buildExecutionTimeline([
      { index: 0, kind: 'step', label: 'message (user)', content: 'fix the bug' },
    ]);
    expect(steps[0].prompt).toBe('fix the bug');
  });
});

describe('parser — timestamp capture', () => {
  it('captures timestamps from plain text logs', () => {
    const r = parseLog('[12:34:56] tool: search input="x"\n[12:34:58] assistant: found it');
    expect(r.timeline[0].timestamp).toBe('12:34:56');
    expect(r.timeline[1].timestamp).toBe('12:34:58');
  });

  it('captures timestamps from generic JSON logs', () => {
    const r = parseLog([{ timestamp: '2026-08-06T10:00:00Z', event: 'tool', tool: 'search', message: 'run' }]);
    expect(r.timeline[0].timestamp).toBe('2026-08-06T10:00:00Z');
  });
});

const app = createApp();
const createdIds: string[] = [];

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.uploadedLog.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe('POST /api/uploads/:id/parse', () => {
  it('parses an uploaded log into structured execution steps', async () => {
    const content = load('openai-loop.json');
    const upload = await request(app).post('/api/uploads').attach('file', Buffer.from(content), 'agent-trace.json');
    expect(upload.status).toBe(201);
    createdIds.push(upload.body.id);

    const res = await request(app).post(`/api/uploads/${upload.body.id}/parse`).attach('file', Buffer.from(content), 'agent-trace.json');
    expect(res.status).toBe(201);
    expect(res.body.uploadedLogId).toBe(upload.body.id);
    expect(res.body.stepCount).toBeGreaterThan(0);
    expect(res.body.steps.length).toBe(res.body.stepCount);
    const step = res.body.steps[0];
    for (const key of ['index', 'timestamp', 'tool', 'prompt', 'response', 'tokensIn', 'tokensOut', 'error']) {
      expect(step).toHaveProperty(key);
    }
    expect(res.body.steps.some((s: { tool: string }) => s.tool === 'apply_patch')).toBe(true);
    expect(res.body.steps.some((s: { error: string }) => s.error !== null)).toBe(false);
  });

  it('marks the upload as parsed', async () => {
    const content = load('openai-loop.json');
    const upload = await request(app).post('/api/uploads').attach('file', Buffer.from(content), 'trace2.json');
    createdIds.push(upload.body.id);
    await request(app).post(`/api/uploads/${upload.body.id}/parse`).attach('file', Buffer.from(content), 'trace2.json');
    const res = await request(app).get(`/api/uploads/${upload.body.id}`);
    expect(res.body.status).toBe('parsed');
  });

  it('parses a CSV upload', async () => {
    const csv = 'step,action,result\n1,start,ok\n2,finish,failed\n';
    const upload = await request(app).post('/api/uploads').attach('file', Buffer.from(csv), 'trace.csv');
    createdIds.push(upload.body.id);
    const res = await request(app).post(`/api/uploads/${upload.body.id}/parse`).attach('file', Buffer.from(csv), 'trace.csv');
    expect(res.status).toBe(201);
    expect(res.body.stepCount).toBeGreaterThan(0);
  });

  it('returns 404 for unknown upload ids', async () => {
    const res = await request(app).post('/api/uploads/nope/parse').attach('file', Buffer.from('{}'), 'x.json');
    expect(res.status).toBe(404);
  });

  it('rejects parsing the same upload twice', async () => {
    const content = load('openai-loop.json');
    const upload = await request(app).post('/api/uploads').attach('file', Buffer.from(content), 'trace3.json');
    createdIds.push(upload.body.id);
    await request(app).post(`/api/uploads/${upload.body.id}/parse`).attach('file', Buffer.from(content), 'trace3.json');
    const res = await request(app).post(`/api/uploads/${upload.body.id}/parse`).attach('file', Buffer.from(content), 'trace3.json');
    expect(res.status).toBe(409);
  });

  it('rejects a file that does not match the stored metadata', async () => {
    const content = load('openai-loop.json');
    const upload = await request(app).post('/api/uploads').attach('file', Buffer.from(content), 'trace4.json');
    createdIds.push(upload.body.id);
    const res = await request(app).post(`/api/uploads/${upload.body.id}/parse`).attach('file', Buffer.from(content), 'other-name.json');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('match');
  });

  it('rejects a request without a file', async () => {
    const content = load('openai-loop.json');
    const upload = await request(app).post('/api/uploads').attach('file', Buffer.from(content), 'trace5.json');
    createdIds.push(upload.body.id);
    const res = await request(app).post(`/api/uploads/${upload.body.id}/parse`).field('note', 'x');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/uploads/:id/execution', () => {
  it('returns the stored execution timeline', async () => {
    const content = load('openai-loop.json');
    const upload = await request(app).post('/api/uploads').attach('file', Buffer.from(content), 'trace6.json');
    createdIds.push(upload.body.id);
    await request(app).post(`/api/uploads/${upload.body.id}/parse`).attach('file', Buffer.from(content), 'trace6.json');
    const res = await request(app).get(`/api/uploads/${upload.body.id}/execution`);
    expect(res.status).toBe(200);
    expect(res.body.stepCount).toBeGreaterThan(0);
    expect(res.body.steps[0]).toHaveProperty('timestamp');
  });

  it('returns 404 when the upload was not parsed', async () => {
    const upload = await request(app).post('/api/uploads').attach('file', Buffer.from('{"ok":true}'), 'trace7.json');
    createdIds.push(upload.body.id);
    const res = await request(app).get(`/api/uploads/${upload.body.id}/execution`);
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not been parsed');
  });

  it('returns 404 for unknown upload ids', async () => {
    const res = await request(app).get('/api/uploads/nope/execution');
    expect(res.status).toBe(404);
  });
});
