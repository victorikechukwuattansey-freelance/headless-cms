import { prisma } from '../db.js';
import type { AnalysisResult } from '../domain/types.js';
import { ApiError } from '../middleware/error.middleware.js';
import { classifyFailure } from './classifier.service.js';
import { parseLog } from './parser.service.js';
import { buildReport } from './report.service.js';

export async function analyzeLog(input: unknown): Promise<AnalysisResult & { id: string; createdAt: Date }> {
  const parsed = parseLog(input);

  if (parsed.timeline.length === 0) {
    throw new ApiError(400, 'Could not extract any events from the log. Is it a valid agent log (JSON, JSONL, or text)?');
  }

  const verdict = classifyFailure(parsed.timeline);
  const report = buildReport(verdict, parsed.timeline);

  const saved = await prisma.report.create({
    data: {
      summary: report.summary,
      failureType: report.failureType,
      rootCause: report.rootCause,
      confidence: report.confidence,
      recommendedFix: report.recommendedFix,
      preventionStrategy: report.preventionStrategy,
      sourceFormat: parsed.format,
      redactions: parsed.redactions,
      steps: {
        create: parsed.timeline.map((t) => ({
          order: t.index,
          kind: t.kind,
          label: t.label,
          content: t.content,
          outcome: t.outcome ?? null,
          tokensIn: t.tokensIn ?? null,
          tokensOut: t.tokensOut ?? null,
        })),
      },
      evidences: {
        create: verdict.evidence.map((e) => ({
          label: e.label,
          detail: e.detail,
          severity: e.severity,
        })),
      },
    },
  });

  return {
    id: saved.id,
    createdAt: saved.createdAt,
    failure: verdict,
    timeline: parsed.timeline,
    redactions: parsed.redactions,
  };
}
