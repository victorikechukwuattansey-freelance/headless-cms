import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

const app = createApp();
const createdIds: string[] = [];

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.uploadedLog.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe('POST /api/uploads', () => {
  it('accepts a valid JSON file and stores metadata only', async () => {
    const res = await request(app).post('/api/uploads').attach('file', Buffer.from('{"ok": true}'), 'log.json');
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.fileName).toBe('log.json');
    expect(res.body.sourceFormat).toBe('json');
    expect(res.body.sizeBytes).toBeGreaterThan(0);
    expect(res.body.status).toBe('uploaded');
    createdIds.push(res.body.id);
  });

  it('accepts a valid CSV file', async () => {
    const csv = 'step,action,result\n1,start,ok\n2,finish,failed\n';
    const res = await request(app).post('/api/uploads').attach('file', Buffer.from(csv), 'trace.csv');
    expect(res.status).toBe(201);
    expect(res.body.sourceFormat).toBe('csv');
    createdIds.push(res.body.id);
  });

  it('accepts a valid TXT file', async () => {
    const res = await request(app).post('/api/uploads').attach('file', Buffer.from('some plain text'), 'notes.txt');
    expect(res.status).toBe(201);
    expect(res.body.sourceFormat).toBe('txt');
    createdIds.push(res.body.id);
  });

  it('rejects invalid JSON', async () => {
    const res = await request(app).post('/api/uploads').attach('file', Buffer.from('{"broken": '), 'bad.json');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('JSON');
  });

  it('rejects CSV with inconsistent column counts', async () => {
    const csv = 'step,action\n1,start,extra\n';
    const res = await request(app).post('/api/uploads').attach('file', Buffer.from(csv), 'ragged.csv');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('column');
  });

  it('rejects an empty file', async () => {
    const res = await request(app).post('/api/uploads').attach('file', Buffer.from(''), 'empty.txt');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('empty');
  });

  it('rejects unsupported file types', async () => {
    const res = await request(app).post('/api/uploads').attach('file', Buffer.from('x'), 'evil.exe');
    expect(res.status).toBe(400);
  });

  it('rejects non-UTF-8 content', async () => {
    const res = await request(app).post('/api/uploads').attach('file', Buffer.from([0xff, 0xfe, 0xfd]), 'binary.txt');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('UTF-8');
  });

  it('rejects files over the 10 MB limit with 413', async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0x61);
    const res = await request(app).post('/api/uploads').attach('file', big, 'big.json');
    expect(res.status).toBe(413);
  });

  it('rejects a request without a file', async () => {
    const res = await request(app).post('/api/uploads').field('note', 'no file here');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/uploads', () => {
  it('lists stored uploads', async () => {
    const res = await request(app).get('/api/uploads');
    expect(res.status).toBe(200);
    expect(res.body.uploads.length).toBeGreaterThan(0);
    for (const id of createdIds) {
      expect(res.body.uploads.some((u: { id: string }) => u.id === id)).toBe(true);
    }
  });
});

describe('GET /api/uploads/:id', () => {
  it('returns a single upload', async () => {
    const id = createdIds[0];
    const res = await request(app).get(`/api/uploads/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.status).toBe('uploaded');
  });

  it('returns 404 for unknown ids', async () => {
    const res = await request(app).get('/api/uploads/nope');
    expect(res.status).toBe(404);
  });
});

describe('uploads are not analyzed', () => {
  it('creates no ParsedExecution and no report for an upload', async () => {
    const log = await prisma.uploadedLog.findFirst({
      where: { id: { in: createdIds } },
      include: { execution: true },
    });
    expect(log).not.toBeNull();
    expect(log?.execution).toBeNull();
  });
});
