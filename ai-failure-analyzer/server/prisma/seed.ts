import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyFailure } from '../src/services/classifier.service.js';
import { parseLog } from '../src/services/parser.service.js';
import { buildReport } from '../src/services/report.service.js';

const prisma = new PrismaClient();

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');

interface DemoLog {
  fileName: string;
  fixture: string;
  raw: boolean;
}

const DEMO_LOGS: DemoLog[] = [
  { fileName: 'openai-loop.json', fixture: 'openai-loop.json', raw: false },
  { fileName: 'api-failure.json', fixture: 'generic-api-failure.json', raw: false },
  { fileName: 'langchain-timeout.json', fixture: 'langchain-timeout.json', raw: false },
];

async function main(): Promise<void> {
  const existing = await prisma.uploadedLog.count();
  if (existing > 0) {
    console.log(`Seed skipped — ${existing} log(s) already exist.`);
    return;
  }

  const user = await prisma.user.create({
    data: { email: 'owner@example.com', name: 'Demo Owner' },
  });

  const project = await prisma.project.create({
    data: {
      name: 'Demo Agent',
      description: 'Example agent project for the MVP — 3 pre-analyzed failures',
      userId: user.id,
    },
  });

  for (const demo of DEMO_LOGS) {
    const raw = readFileSync(path.join(fixturesDir, demo.fixture), 'utf-8');
    const input = demo.raw ? raw : JSON.parse(raw);
    const parsed = parseLog(input);
    const verdict = classifyFailure(parsed.timeline);
    const report = buildReport(verdict, parsed.timeline);

    await prisma.uploadedLog.create({
      data: {
        projectId: project.id,
        fileName: demo.fileName,
        sourceFormat: parsed.format,
        sizeBytes: Buffer.byteLength(raw),
        redactions: parsed.redactions,
        status: 'analyzed',
        execution: {
          create: {
            steps: parsed.timeline as unknown as object,
            report: {
              create: {
                summary: report.summary,
                failureType: report.failureType,
                rootCause: report.rootCause,
                confidence: report.confidence,
                recommendedFix: report.recommendedFix,
                preventionStrategy: report.preventionStrategy,
                evidence: verdict.evidence as unknown as object,
              },
            },
          },
        },
      },
    });
    console.log(`  seeded ${demo.fileName} → ${report.failureType} (${parsed.format})`);
  }

  console.log('Seed complete — 1 user, 1 project, 3 analyzed logs.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
