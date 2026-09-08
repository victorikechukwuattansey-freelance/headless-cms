import { prisma } from '../db.js';
import type { AnalysisResult } from '../domain/types.js';
import { ApiError } from '../middleware/error.middleware.js';
import { classifyFailure } from './classifier.service.js';
import { parseLog } from './parser.service.js';
import { buildReport } from './report.service.js';
import { resolveProject } from './project.service.js';

export async function analyzeLog(input: unknown): Promise<AnalysisResult & { id: string; createdAt: Date }> {
  const parsed = parseLog(input);

  if (parsed.timeline.length === 0) {
    throw new ApiError(400, 'Could not extract any events from the log. Is it a valid agent log (JSON, JSONL, or text)?');
  }

  const verdict = classifyFailure(parsed.timeline);
  const report = buildReport(verdict, parsed.timeline);
  const project = await resolveProject();
  const sizeBytes = Buffer.byteLength(typeof input === 'string' ? input : JSON.stringify(input));

  const uploadedLog = await prisma.uploadedLog.create({
    data: {
      projectId: project.id,
      fileName: `upload-${Date.now()}.log`,
      sourceFormat: parsed.format,
      sizeBytes,
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
    include: { execution: { include: { report: true } } },
  });

  return {
    id: uploadedLog.id,
    createdAt: uploadedLog.createdAt,
    failure: verdict,
    timeline: parsed.timeline,
    redactions: parsed.redactions,
  };
}
