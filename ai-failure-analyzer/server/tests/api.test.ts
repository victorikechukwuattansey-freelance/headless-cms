import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const load = (name: string): string => readFileSync(path.join(fixtures, name), 'utf-8');

const app = createApp();
let createdIds: string[] = [];

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.uploadedLog.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe('POST /api/analyze', () => {
  it('accepts a JSON body and returns a full analysis', async () => {
    const res = await request(app).post('/api/analyze').send({ log: JSON.parse(load('openai-loop.json')) });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.failure.type).toBe('infinite_loop');
    expect(res.body.timeline.length).toBeGreaterThan(0);
    createdIds.push(res.body.id);
  });

  it('accepts a file upload', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .attach('log', Buffer.from(load('plaintext-hallucination.log')), 'agent.log');
    expect(res.status).toBe(201);
    expect(res.body.failure.type).toBe('hallucination');
    createdIds.push(res.body.id);
  });

  it('accepts log text as a string', async () => {
    const res = await request(app).post('/api/analyze').send({ log: load('plaintext-invalid-output.log') });
    expect(res.status).toBe(201);
    expect(res.body.failure.type).toBe('invalid_output');
    createdIds.push(res.body.id);
  });

  it('rejects empty logs', async () => {
    const res = await request(app).post('/api/analyze').send({ log: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects unsupported file types', async () => {
    const res = await request(app).post('/api/analyze').attach('log', Buffer.from('x'), 'evil.exe');
    expect(res.status).toBe(400);
  });

  it('redacts secrets before returning the timeline', async () => {
    const res = await request(app).post('/api/analyze').send({ log: JSON.parse(load('openai-secrets.json')) });
    expect(res.status).toBe(201);
    expect(res.body.redactions).toBeGreaterThanOrEqual(2);
    const blob = JSON.stringify(res.body.timeline);
    expect(blob).not.toContain('sk-ABC12345678901234567890');
    createdIds.push(res.body.id);
  });
});

describe('GET /api/reports', () => {
  it('lists reports including the ones just created', async () => {
    const res = await request(app).get('/api/reports');
    expect(res.status).toBe(200);
    expect(res.body.reports.length).toBeGreaterThan(0);
    for (const id of createdIds) {
      expect(res.body.reports.some((r: { id: string }) => r.id === id)).toBe(true);
    }
  });
});

describe('GET /api/reports/:id', () => {
  it('returns a report with steps and evidence', async () => {
    const id = createdIds[0];
    const res = await request(app).get(`/api/reports/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.steps.length).toBeGreaterThan(0);
    expect(res.body.evidences.length).toBeGreaterThan(0);
    expect(res.body.failureType).toBe('infinite_loop');
  });

  it('returns 404 for unknown ids', async () => {
    const res = await request(app).get('/api/reports/nope');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/reports/:id', () => {
  it('deletes a report', async () => {
    const id = createdIds.pop();
    const res = await request(app).delete(`/api/reports/${id}`);
    expect(res.status).toBe(204);
    const gone = await request(app).get(`/api/reports/${id}`);
    expect(gone.status).toBe(404);
  });
});
