import { prisma } from '../db.js';
import type { EvidenceItem, TimelineEntry } from '../domain/types.js';

export async function listReports(limit = 50) {
  const logs = await prisma.uploadedLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
    include: { execution: { include: { report: true } } },
  });

  return logs
    .filter((log) => log.execution?.report)
    .map((log) => ({
      id: log.id,
      summary: log.execution!.report!.summary,
      failureType: log.execution!.report!.failureType,
      confidence: log.execution!.report!.confidence,
      sourceFormat: log.sourceFormat,
      redactions: log.redactions,
      createdAt: log.createdAt,
    }));
}

export async function getReport(id: string) {
  const log = await prisma.uploadedLog.findUnique({
    where: { id },
    include: { execution: { include: { report: true } } },
  });

  if (!log?.execution?.report) return null;

  const steps = (log.execution.steps as unknown as TimelineEntry[]).map((s) => ({
    ...s,
    order: s.index,
  }));
  const evidences = log.execution.report.evidence as unknown as EvidenceItem[];

  return {
    id: log.id,
    summary: log.execution.report.summary,
    failureType: log.execution.report.failureType,
    rootCause: log.execution.report.rootCause,
    confidence: log.execution.report.confidence,
    recommendedFix: log.execution.report.recommendedFix,
    preventionStrategy: log.execution.report.preventionStrategy,
    sourceFormat: log.sourceFormat,
    stepCount: steps.length,
    evidenceCount: evidences.length,
    redactions: log.redactions,
    createdAt: log.createdAt,
    steps,
    evidences,
  };
}

export async function deleteReport(id: string) {
  return prisma.uploadedLog.delete({ where: { id } });
}
