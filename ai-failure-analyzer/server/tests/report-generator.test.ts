import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import type { TimelineEntry } from '../src/domain/types.js';
import { classifyFailure } from '../src/services/classifier.service.js';
import { parseLog } from '../src/services/parser.service.js';
import { generateRootCauseReport, type ReportSource } from '../src/services/report-generator.service.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const load = (name: string): string => readFileSync(path.join(fixtures, name), 'utf-8');

function sourceFrom(fixture: string, raw = false): ReportSource {
  const input = raw ? fixture : JSON.parse(fixture);
  const parsed = parseLog(input);
  const verdict = classifyFailure(parsed.timeline);
  const steps = parsed.timeline.map((s, i) => ({ ...s, order: i }));
  return {
    id: 'report-1',
    summary: 'test summary',
    failureType: verdict.type,
    rootCause: verdict.rootCause,
    confidence: verdict.confidence,
    recommendedFix: verdict.fix,
    preventionStrategy: verdict.prevention,
    sourceFormat: parsed.format,
    stepCount: steps.length,
    evidenceCount: verdict.evidence.length,
    redactions: parsed.redactions,
    createdAt: new Date(),
    steps,
    evidences: verdict.evidence,
  };
}

describe('generateRootCauseReport', () => {
  it('contains all six sections in the document', () => {
    const doc = generateRootCauseReport(sourceFrom(load('openai-loop.json'))).document;
    for (const heading of [
      '## Executive Summary',
      '## Failure Timeline',
      '## Root Cause',
      '## Evidence',
      '## Suggested Fixes',
      '## Prevention Strategy',
    ]) {
      expect(doc).toContain(heading);
    }
    expect(doc).toContain('# Root Cause Analysis Report');
  });

  it('writes the summary in plain English with type and confidence', () => {
    const report = generateRootCauseReport(sourceFrom(load('openai-loop.json')));
    expect(report.failureType).toBe('infinite_loop');
    expect(report.executiveSummary).toContain('infinite loop');
    expect(report.executiveSummary).toContain('% confidence');
    expect(report.executiveSummary).toContain('timeline event');
  });

  it('renders tool calls and responses as plain sentences', () => {
    const report = generateRootCauseReport(sourceFrom(load('openai-loop.json')));
    expect(report.timeline.some((l) => /^Called the tool /.test(l))).toBe(true);
    expect(report.timeline.some((l) => /^The agent responded:/.test(l))).toBe(true);
  });

  it('renders failures as plain sentences', () => {
    const report = generateRootCauseReport(sourceFrom(load('plaintext-invalid-output.log'), true));
    expect(report.timeline.some((l) => l.includes('Step failed:'))).toBe(true);
  });

  it('caps the timeline at 25 steps and notes omissions', () => {
    const steps: TimelineEntry[] = Array.from({ length: 40 }, (_, i) => ({
      index: i,
      kind: 'step',
      label: 'step',
      content: `event ${i}`,
    }));
    const src = sourceFrom(load('openai-loop.json'));
    const report = generateRootCauseReport({ ...src, steps: steps.map((s, i) => ({ ...s, order: i })), stepCount: 40 });
    expect(report.timeline.length).toBe(26);
    expect(report.timeline[0]).toContain('omitted');
  });

  it('renders evidence with label and detail', () => {
    const report = generateRootCauseReport(sourceFrom(load('openai-loop.json')));
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.evidence[0]).toMatch(/^\*\*.*\*\* \(/);
  });

  it('keeps the timestamp in timeline lines when present', () => {
    const src = sourceFrom(load('openai-loop.json'));
    const steps = [{ ...src.steps[0], timestamp: '12:34:56' }];
    const report = generateRootCauseReport({ ...src, steps, stepCount: 1 });
    expect(report.timeline[0]).toMatch(/^\[12:34:56\]/);
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

describe('GET /api/reports/:id/document', () => {
  it('returns a complete plain-English report for an analyzed log', async () => {
    const analyzed = await request(app).post('/api/analyze').send({ log: JSON.parse(load('openai-loop.json')) });
    expect(analyzed.status).toBe(201);
    createdIds.push(analyzed.body.id);

    const res = await request(app).get(`/api/reports/${analyzed.body.id}/document`);
    expect(res.status).toBe(200);
    expect(res.body.failureType).toBe('infinite_loop');
    expect(res.body.executiveSummary.length).toBeGreaterThan(10);
    expect(res.body.timeline.length).toBeGreaterThan(0);
    expect(res.body.document).toContain('## Executive Summary');
    expect(res.body.document).toContain('## Prevention Strategy');
  });

  it('returns 404 for unknown report ids', async () => {
    const res = await request(app).get('/api/reports/nope/document');
    expect(res.status).toBe(404);
  });
});
